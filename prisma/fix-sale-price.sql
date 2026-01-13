-- Add salePrice column as nullable
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "salePrice" DOUBLE PRECISION;

-- Update existing rows: copy price to salePrice
UPDATE "Product" SET "salePrice" = "price" WHERE "salePrice" IS NULL;

