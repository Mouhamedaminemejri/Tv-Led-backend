import { PrismaClient } from '@prisma/client';
import { buildProductTitle } from '../src/products/utils/build-product-title';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Updating all products to Direct LED + new title format...');

  const products = await prisma.product.findMany({
    select: {
      id: true,
      brand: true,
      tvSizeInch: true,
      stripCount: true,
      ledCount: true,
      voltage: true,
      length: true,
    },
  });

  const chunkSize = 200;
  let updated = 0;

  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    await prisma.$transaction(
      chunk.map((p) =>
        prisma.product.update({
          where: { id: p.id },
          data: {
            tvBacklightType: 'Direct LED',
            title: buildProductTitle({
              tvBacklightType: 'Direct LED',
              brand: p.brand,
              tvSizeInch: p.tvSizeInch,
              stripCount: p.stripCount,
              ledCount: p.ledCount,
              voltage: p.voltage,
              length: p.length,
            }),
          },
        }),
      ),
    );
    updated += chunk.length;
    console.log(`✅ Updated ${updated}/${products.length}`);
  }

  console.log(`✨ Done. Updated ${updated} products.`);
}

main()
  .catch((err) => {
    console.error('❌ Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

