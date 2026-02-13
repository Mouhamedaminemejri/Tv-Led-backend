import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { normalizeProductConfig } from '../src/products/utils/normalize-product-config';
import { buildProductTitle } from '../src/products/utils/build-product-title';

const prisma = new PrismaClient();

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const DEFAULT_API_BASE_URL = 'http://localhost:3001';
const DEFAULT_CSV_PATH = path.join(
  'C:',
  'Users',
  'MohamedAmineMejri',
  'Downloads',
  'NDFT_Inventory_Final_Clean (1).csv',
);
const DEFAULT_IMAGE_BASE_DIR = path.join(
  process.cwd(),
  'dataSet',
  'NDFT_Images',
);

type NdftCsvRow = {
  'Reference ID'?: string;
  'Marking (Full)'?: string;
  Brand?: string;
  Title?: string;
  Compatibility?: string;
  Size?: string | number;
  Bars?: string | number;
  LEDs?: string | number;
  Voltage?: string | number;
  Length?: string;
  Pins?: string;
  'Image Path'?: string;
  URL?: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function sanitizePathSegment(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

function toUploadsPublicUrl(apiBaseUrl: string, relativePath: string): string {
  const normalized = relativePath.split(path.sep).join('/');
  return `${normalizeBaseUrl(apiBaseUrl)}/uploads/${normalized}`;
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function listImagesInDir(dirPath: string): string[] {
  try {
    if (!fs.existsSync(dirPath)) return [];
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) return [];

    return fs
      .readdirSync(dirPath)
      .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .map((name) => path.join(dirPath, name));
  } catch {
    return [];
  }
}

function copyImageToUploads(
  sourcePath: string,
  uploadsRoot: string,
  apiBaseUrl: string,
  reference: string,
): string | null {
  try {
    if (!fs.existsSync(sourcePath)) return null;
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile()) return null;

    const ext = path.extname(sourcePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return null;

    const safeRef = sanitizePathSegment(reference || 'unknown');
    const fileName = sanitizePathSegment(path.basename(sourcePath));
    const destinationDir = path.join(uploadsRoot, 'imported', safeRef);
    ensureDir(destinationDir);

    const destinationPath = path.join(destinationDir, fileName);
    fs.copyFileSync(sourcePath, destinationPath);

    const relativePath = path.join('imported', safeRef, fileName);
    return toUploadsPublicUrl(apiBaseUrl, relativePath);
  } catch {
    return null;
  }
}

function parseFirstNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(',', '.');
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = parseFloat(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseTvSize(value: unknown): number | null {
  const parsed = parseFirstNumber(value);
  if (parsed === null) return null;
  return Math.round(parsed);
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function toLengthCmDisplay(rawLength: string | null): string | null {
  if (!rawLength) return null;
  const normalized = rawLength.replace(/,/g, '.');
  const matches = Array.from(normalized.matchAll(/(\d+(?:\.\d+)?)\s*(mm|мм|cm|см)?/gi));
  if (matches.length === 0) return null;

  const converted = matches
    .map((m) => {
      const value = parseFloat(m[1]);
      if (Number.isNaN(value)) return null;
      const unit = (m[2] || '').toLowerCase();
      const cm = unit === 'cm' || unit === 'см' ? value : value / 10;
      const rounded = Number.isInteger(cm) ? cm.toString() : cm.toFixed(1).replace(/\.0$/, '');
      return `${rounded} cm`;
    })
    .filter((v): v is string => Boolean(v));

  if (converted.length === 0) return null;
  return converted.join(' + ');
}

function calculatePrice(tvSizeInch: number | null): number {
  if (!tvSizeInch || Number.isNaN(tvSizeInch)) return 99;
  return Math.max(50, Math.round(tvSizeInch * 5));
}

async function main() {
  console.log('🚀 Starting NDFT CSV import...');

  const csvPath = process.env.IMPORT_CSV_PATH || DEFAULT_CSV_PATH;
  const imageBaseDir = process.env.IMPORT_IMAGE_BASE_DIR || DEFAULT_IMAGE_BASE_DIR;
  const apiBaseUrl = process.env.API_BASE_URL || DEFAULT_API_BASE_URL;
  const uploadsRoot = path.join(process.cwd(), 'uploads');

  console.log(`📖 CSV file: ${csvPath}`);
  console.log(`🖼️ Image base dir: ${imageBaseDir}`);
  console.log(`🌐 Public image base URL: ${apiBaseUrl}`);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }
  if (!fs.existsSync(imageBaseDir)) {
    console.warn(`⚠️ Image folder not found: ${imageBaseDir}. Import will continue without images.`);
  }

  const workbook = XLSX.readFile(csvPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: NdftCsvRow[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`📦 Rows detected: ${rows.length}`);

  // Step 1: clean tables in FK-safe order
  console.log('🗑️ Clearing existing data...');
  await prisma.cart.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.order.deleteMany({});
  const deleted = await prisma.product.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.supplier.deleteMany({});
  console.log(`✅ Deleted ${deleted.count} old products`);

  // Step 2: preload brands
  const brands = Array.from(
    new Set(
      rows
        .map((row) => normalizeText(row.Brand) || 'Generic')
        .filter((v) => v.length > 0),
    ),
  );
  if (brands.length > 0) {
    await prisma.brand.createMany({
      data: brands.map((name) => ({ name })),
      skipDuplicates: true,
    });
  }
  console.log(`🏷️ Prepared ${brands.length} brands`);

  // Step 3: transform + import
  let successCount = 0;
  let skipCount = 0;
  const batchSize = 100;
  const config = normalizeProductConfig(undefined).configString;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    const transformed = batch
      .map((row) => {
        const reference = normalizeText(row['Reference ID']);
        if (!reference) {
          skipCount += 1;
          return null;
        }

        const brand = normalizeText(row.Brand) || 'Generic';
        const fullMarking = normalizeText(row['Marking (Full)']);
        const tvBacklightType = 'Direct LED';
        const tvSizeInch = parseTvSize(row.Size);
        const stripCount = normalizeText(row.Bars);
        const ledCount = normalizeText(row.LEDs);
        const voltage = parseFirstNumber(row.Voltage);
        const rawLength = normalizeText(row.Length);
        const lengthCmDisplay = toLengthCmDisplay(rawLength);
        const title = buildProductTitle({
          tvBacklightType,
          brand,
          tvSizeInch,
          stripCount,
          ledCount,
          voltage,
          length: lengthCmDisplay || rawLength,
        });

        // image folder is expected to be named with reference id
        const folderImages = listImagesInDir(path.join(imageBaseDir, reference));
        const images = folderImages
          .map((imgPath) => copyImageToUploads(imgPath, uploadsRoot, apiBaseUrl, reference))
          .filter((img): img is string => Boolean(img));

        const price = calculatePrice(tvSizeInch);
        const salePrice = price;

        return {
          suk: reference,
          reference,
          brand,
          title,
          tvBacklightType,
          tvSizeInch,
          stripCount,
          ledCount,
          voltage,
          length: lengthCmDisplay || rawLength,
          models: normalizeText(row.Compatibility),
          tvFullName: normalizeText(row['Marking (Full)']),
          config,
          price,
          salePrice,
          stock: Math.floor(Math.random() * 90) + 10,
          rating: Math.floor(Math.random() * 5),
          tags: ['LED', 'TV', brand],
          images,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (transformed.length === 0) continue;

    await prisma.product.createMany({
      data: transformed as any,
      skipDuplicates: true,
    });

    successCount += transformed.length;
    console.log(
      `✅ Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} (${successCount} items)`,
    );
  }

  const totalProducts = await prisma.product.count();
  console.log('\n✨ NDFT import completed');
  console.log(`✅ Imported rows: ${successCount}`);
  console.log(`⏭️ Skipped rows (missing Reference ID): ${skipCount}`);
  console.log(`📊 Total products in database: ${totalProducts}`);
}

main()
  .catch((err) => {
    console.error('❌ Import failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

