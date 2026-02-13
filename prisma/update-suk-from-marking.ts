import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

const DEFAULT_CSV_PATH = path.join(
  'C:',
  'Users',
  'MohamedAmineMejri',
  'Downloads',
  'NDFT_Inventory_Final_Clean (1).csv',
);

type NdftCsvRow = {
  'Reference ID'?: string;
  'Marking (Full)'?: string;
};

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function buildUniqueSuk(base: string, reference: string, used: Set<string>): string {
  // Keep exact Marking(Full) when unique; add reference suffix only if needed.
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  const withRef = `${base} | ${reference}`;
  if (!used.has(withRef)) {
    used.add(withRef);
    return withRef;
  }

  let i = 2;
  while (used.has(`${withRef} (${i})`)) {
    i += 1;
  }
  const finalValue = `${withRef} (${i})`;
  used.add(finalValue);
  return finalValue;
}

async function main() {
  const csvPath = process.env.IMPORT_CSV_PATH || DEFAULT_CSV_PATH;
  console.log(`📖 CSV file: ${csvPath}`);

  const workbook = XLSX.readFile(csvPath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows: NdftCsvRow[] = XLSX.utils.sheet_to_json(worksheet);

  console.log(`📦 Rows detected: ${rows.length}`);

  const references = rows
    .map((r) => normalizeText(r['Reference ID']))
    .filter((v): v is string => Boolean(v));

  const products = await prisma.product.findMany({
    where: {
      reference: { in: references },
    },
    select: {
      id: true,
      reference: true,
      suk: true,
    },
  });

  const productByRef = new Map(products.map((p) => [p.reference, p]));
  const usedSukValues = new Set(
    products.map((p) => normalizeText(p.suk)).filter((v): v is string => Boolean(v)),
  );

  let updated = 0;
  let skippedNoReference = 0;
  let skippedNoMarking = 0;
  let skippedNotFound = 0;

  for (const row of rows) {
    const reference = normalizeText(row['Reference ID']);
    if (!reference) {
      skippedNoReference += 1;
      continue;
    }

    const marking = normalizeText(row['Marking (Full)']);
    if (!marking) {
      skippedNoMarking += 1;
      continue;
    }

    const product = productByRef.get(reference);
    if (!product) {
      skippedNotFound += 1;
      continue;
    }

    const nextSuk = buildUniqueSuk(marking, reference, usedSukValues);
    await prisma.product.update({
      where: { id: product.id },
      data: {
        suk: nextSuk,
        tvFullName: marking,
      },
    });
    updated += 1;
  }

  console.log('✅ Update completed');
  console.log(`Updated products: ${updated}`);
  console.log(`Skipped (missing Reference ID): ${skippedNoReference}`);
  console.log(`Skipped (missing Marking (Full)): ${skippedNoMarking}`);
  console.log(`Skipped (reference not found in DB): ${skippedNotFound}`);
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

