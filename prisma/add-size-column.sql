-- Add size column to Product table
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "size" INTEGER;

-- Extract size from title for existing products (number before "inch")
UPDATE "Product" 
SET "size" = CAST(
  SUBSTRING(
    "title" FROM '(\d+)\s*inch'
  ) AS INTEGER
)
WHERE "title" ~ '\d+\s*inch' AND "size" IS NULL;

