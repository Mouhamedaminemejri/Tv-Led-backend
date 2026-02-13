import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { buildProductTitle } from '../src/products/utils/build-product-title';
import { normalizeProductConfig } from '../src/products/utils/normalize-product-config';

const prisma = new PrismaClient();

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const DEFAULT_API_BASE_URL = 'http://localhost:3001';

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

function getImagesForReferenceFolder(baseDir: string, ref: string | null | undefined): string[] {
  if (!ref) return [];
  const normalized = String(ref).trim();
  if (!normalized) return [];
  return listImagesInDir(path.join(baseDir, normalized));
}

function copyImageToUploads(
  sourcePath: string,
  uploadsRoot: string,
  apiBaseUrl: string,
  referenceOrSuk: string,
): string | null {
  try {
    if (!sourcePath || !fs.existsSync(sourcePath)) return null;
    const stat = fs.statSync(sourcePath);
    if (!stat.isFile()) return null;

    const ext = path.extname(sourcePath).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) return null;

    const safeRef = sanitizePathSegment(referenceOrSuk || 'unknown');
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

function toImportableImageSource(value: string, imageBaseDir: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Already a URL/public path.
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/uploads/')
  ) {
    return trimmed;
  }

  // Absolute local path.
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) {
    return trimmed;
  }

  // Relative to the configured image base directory.
  const relativeCandidate = path.join(imageBaseDir, trimmed);
  if (fs.existsSync(relativeCandidate)) {
    return relativeCandidate;
  }

  // Unresolvable value (likely just a filename not present on disk).
  return null;
}

// Interface matching the Excel headers
interface ExcelProduct {
  SUK: number | string;
  Brand: string;
  'Image of references': string;
  'References + Google references': string; // This seems to be the main reference
  'Dimension inch '?: string | number; // Note the trailing space
  'Number strip'?: number;
  'Number leds'?: number;
  Voltage?: number;
  length?: string;
  Models?: string; // Comma separated models
}

async function main() {
  console.log('🚀 Starting product import from Excel...');

  try {
    // Step 1: Delete all existing data in correct order (respecting foreign keys)
    console.log('🗑️  Deleting all existing data...');

    // Clear carts (they may contain productIds that will be deleted)
    await prisma.cart.deleteMany({});

    // Delete OrderItems first (they reference Products)
    await prisma.orderItem.deleteMany({});

    // Delete Orders and Payments
    await prisma.payment.deleteMany({});
    await prisma.order.deleteMany({});

    // Now delete products (no foreign key constraints)
    const deleteResult = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.count} existing products`);

    // Cleanup lookup tables once products are removed.
    await prisma.brand.deleteMany({});
    await prisma.supplier.deleteMany({});

    // Step 2: Read Excel file
    const excelPath =
      process.env.IMPORT_EXCEL_PATH ||
      path.join(__dirname, '..', 'dataSet', '11 REFENRENCES.xlsx');

    // Base folder that contains reference-named folders with images.
    // Default: the Excel file's folder.
    const imageBaseDir =
      process.env.IMPORT_IMAGE_BASE_DIR ||
      path.dirname(excelPath);
    const apiBaseUrl = process.env.API_BASE_URL || DEFAULT_API_BASE_URL;
    const uploadsRoot = path.join(process.cwd(), 'uploads');

    console.log(`📖 Reading Excel file from: ${excelPath}`);
    console.log(`🖼️  Reading images from base folder: ${imageBaseDir}`);
    console.log(`🌐 Public image base URL: ${apiBaseUrl}`);

    if (!fs.existsSync(excelPath)) {
      throw new Error(`Excel file not found at: ${excelPath}`);
    }

    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Parse Excel data with headers
    const rawProducts: ExcelProduct[] = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📦 Found ${rawProducts.length} rows in Excel file`);

    const brandNames = Array.from(
      new Set(
        rawProducts
          .map((row) => (row.Brand ? String(row.Brand).trim() : 'Generic'))
          .filter((name) => name.length > 0),
      ),
    );

    if (brandNames.length > 0) {
      await prisma.brand.createMany({
        data: brandNames.map((name) => ({ name })),
        skipDuplicates: true,
      });
      console.log(`🏷️  Prepared ${brandNames.length} brands`);
    }

    // Step 3: Transform and import products
    console.log('🔄 Transforming and importing products...');
    let successCount = 0;
    let errorCount = 0;

    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < rawProducts.length; i += batchSize) {
      const batch = rawProducts.slice(i, i + batchSize);

      const transformedProducts = batch.map((row) => {
        try {
          // Normalize SUK (Excel) to suk (DB)
          const suk = row.SUK ? String(row.SUK).trim() : null;

          // Use 'References + Google references' as the main reference field
          const reference = row['References + Google references']
            ? String(row['References + Google references']).trim()
            : `REF-${suk || Math.random().toString(36).substring(7)}`;

          const brand = row.Brand ? String(row.Brand).trim() : 'Generic';

          // Extract size (dimension)
          let tvSizeInch: number | null = null;
          if (row['Dimension inch ']) {
            const sizeStr = String(row['Dimension inch ']).trim();
            // Try to find first number
            const match = sizeStr.match(/(\d+)/);
            if (match) {
              tvSizeInch = parseInt(match[1], 10);
            }
          }

          // Get technical specs as strings
          const stripCount = row['Number strip'] ? String(row['Number strip']) : null;
          const ledCount = row['Number leds'] ? String(row['Number leds']) : null;
          const voltage = row.Voltage ? Number(row.Voltage) : null;
          const length = row.length ? String(row.length) : null;

          // Generate title per required format:
          // led backlight + brand tv + inch + number strip + number led + text(Pieces) + voltage + text(V) + length
          const title = buildProductTitle({
            tvBacklightType: 'Direct LED',
            brand,
            tvSizeInch,
            stripCount,
            ledCount,
            voltage,
            length,
          });

          // Handle images: prefer reference-named folder images, fallback to Excel cell if present.
          const folderImages =
            getImagesForReferenceFolder(imageBaseDir, reference).length > 0
              ? getImagesForReferenceFolder(imageBaseDir, reference)
              : getImagesForReferenceFolder(imageBaseDir, suk);

          const imageCell = row['Image of references']
            ? String(row['Image of references']).trim()
            : null;

          const sourceCandidates = [
            ...folderImages,
            ...(imageCell ? [imageCell] : []),
          ];

          const imageKey = reference || suk || 'unknown';
          const images = sourceCandidates
            .map((candidate) => {
              const source = toImportableImageSource(candidate, imageBaseDir);
              if (!source) return null;
              if (
                source.startsWith('http://') ||
                source.startsWith('https://') ||
                source.startsWith('/uploads/')
              ) {
                return source;
              }
              return copyImageToUploads(source, uploadsRoot, apiBaseUrl, imageKey);
            })
            .filter((img): img is string => typeof img === 'string' && img.length > 0)
            .filter((img, idx, arr) => arr.indexOf(img) === idx);

          // Generate random data for fields missing in Excel
          const randomStock = Math.floor(Math.random() * 100); // 0 to 99
          const randomRating = Math.floor(Math.random() * 5); // 0 to 4
          const randomPrice = Math.floor(Math.random() * (500 - 50 + 1)) + 50; // 50 to 500
          const randomSalePrice = Math.random() > 0.5 ? randomPrice * 0.8 : randomPrice; // 50% chance of sale
          const config = normalizeProductConfig(undefined).configString;
          const randomTags = ['LED', 'Parts', 'Repair', 'TV', brand];

          return {
            suk: suk, // Map SUK -> suk
            reference: reference, // Main reference
            brand: brand,
            title: title, // Formatted title

            // Excel specific fields
            stripCount: stripCount,
            ledCount: ledCount,
            voltage: voltage,
            length: length,
            models: row.Models ? String(row.Models) : null,
            tvSizeInch: tvSizeInch,
            tvBacklightType: 'Direct LED',

            // Default/Calculated fields
            price: randomPrice,
            salePrice: randomSalePrice,
            config,
            stock: randomStock,
            rating: randomRating,
            images: images,
            tags: randomTags,
          };
        } catch (error) {
          console.error(`Error transforming row with SUK ${row.SUK}:`, error);
          errorCount++;
          return null;
        }
      }).filter((p) => p !== null);

      // Insert batch
      try {
        await prisma.product.createMany({
          data: transformedProducts as any,
          skipDuplicates: true,
        });
        successCount += transformedProducts.length;
        console.log(`✅ Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rawProducts.length / batchSize)} (${successCount} products)`);
      } catch (error) {
        console.error(`❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`, error);
        // If batch fails, try one by one to isolate error (optional, but good for debug)
        // For now just count errors
        errorCount += batch.length;
      }
    }

    console.log('\n✨ Import completed!');
    console.log(`✅ Successfully imported: ${successCount} products`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} rows`);
    }

    // Step 4: Verify import
    const totalProducts = await prisma.product.count();
    console.log(`\n📊 Total products in database: ${totalProducts}`);
  } catch (error) {
    console.error('❌ Error during import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

