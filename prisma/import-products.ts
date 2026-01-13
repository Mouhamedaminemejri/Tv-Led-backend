import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface JsonProduct {
  Number: number | string;
  Reference: string;
  Brand: string;
  Title: string;
  Summary: string;
  PurchasePrice: number;
  Supplier: string;
  SalePrice: number;
  'Description ': string | null;
  'Unnamed: 9': string | null;
}

async function main() {
  console.log('🚀 Starting product import...');

  try {
    // Step 1: Delete all existing data in correct order (respecting foreign keys)
    console.log('🗑️  Deleting all existing data...');
    
    // Delete OrderItems first (they reference Products)
    const deletedOrderItems = await prisma.orderItem.deleteMany({});
    console.log(`✅ Deleted ${deletedOrderItems.count} order items`);
    
    // Delete Orders (they reference Payments)
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`✅ Deleted ${deletedOrders.count} orders`);
    
    // Delete Payments
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`✅ Deleted ${deletedPayments.count} payments`);
    
    // Now delete products (no foreign key constraints)
    const deleteResult = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.count} existing products`);

    // Step 2: Read JSON file
    const jsonPath = path.join(__dirname, '..', 'dataSet', 'ppppp.json');
    console.log(`📖 Reading JSON file from: ${jsonPath}`);

    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON file not found at: ${jsonPath}`);
    }

    const jsonData = fs.readFileSync(jsonPath, 'utf-8');
    
    // Replace NaN values with null before parsing (NaN is not valid JSON)
    const cleanedJsonData = jsonData.replace(/:\s*NaN\s*/g, ': null');
    
    const products: JsonProduct[] = JSON.parse(cleanedJsonData);

    console.log(`📦 Found ${products.length} products in JSON file`);

    // Step 3: Transform and import products
    console.log('🔄 Transforming and importing products...');
    let successCount = 0;
    let errorCount = 0;

    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const transformedProducts = batch.map((product) => {
        try {
          // Handle NaN values and null values
          const purchasePrice = 
            product.PurchasePrice !== null && 
            product.PurchasePrice !== undefined && 
            !isNaN(Number(product.PurchasePrice))
              ? Number(product.PurchasePrice)
              : null;
          
          const salePrice = 
            product.SalePrice !== null && 
            product.SalePrice !== undefined && 
            !isNaN(Number(product.SalePrice))
              ? Number(product.SalePrice)
              : 0;

          // Extract TV size from title (number before "inch")
          // Example: "LED strip set LG 32 inch" -> 32
          let size: number | null = null;
          const title = product.Title || '';
          const inchMatch = title.match(/(\d+)\s*inch/i);
          if (inchMatch && inchMatch[1]) {
            const extractedSize = parseInt(inchMatch[1], 10);
            if (!isNaN(extractedSize)) {
              size = extractedSize;
            }
          }

          return {
            number: product.Number ? String(product.Number) : null,
            reference: product.Reference || '',
            brand: product.Brand || '',
            title: product.Title || '',
            summary: product.Summary || null,
            purchasePrice: purchasePrice,
            supplier: product.Supplier || null,
            salePrice: salePrice,
            price: salePrice, // Keep price for backward compatibility
            description: product['Description ']?.trim() || null,
            size: size,
            stock: 0, // Default stock
            rating: 0, // Default rating
            images: [],
            tags: [],
          };
        } catch (error) {
          console.error(`Error transforming product ${product.Reference}:`, error);
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
        console.log(`✅ Imported batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(products.length / batchSize)} (${successCount}/${products.length} products)`);
      } catch (error) {
        console.error(`❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`, error);
        errorCount += batch.length;
      }
    }

    console.log('\n✨ Import completed!');
    console.log(`✅ Successfully imported: ${successCount} products`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} products`);
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

