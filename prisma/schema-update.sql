-- Product normalization and integrity updates
-- 1) Normalize Brand/Supplier into lookup tables
-- 2) Remove summary/description (frontend-generated)
-- 3) Harden numeric and rating constraints

BEGIN;

CREATE TABLE IF NOT EXISTS "Brand" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fill lookup tables from existing product data
INSERT INTO "Brand" ("id", "name")
SELECT md5(random()::text || clock_timestamp()::text || DISTINCT_BRAND."brand"), DISTINCT_BRAND."brand"
FROM (
  SELECT DISTINCT TRIM("brand") AS "brand"
  FROM "Product"
  WHERE "brand" IS NOT NULL AND TRIM("brand") <> ''
) AS DISTINCT_BRAND
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Supplier" ("id", "name")
SELECT md5(random()::text || clock_timestamp()::text || DISTINCT_SUPPLIER."supplier"), DISTINCT_SUPPLIER."supplier"
FROM (
  SELECT DISTINCT TRIM("supplier") AS "supplier"
  FROM "Product"
  WHERE "supplier" IS NOT NULL AND TRIM("supplier") <> ''
) AS DISTINCT_SUPPLIER
ON CONFLICT ("name") DO NOTHING;

ALTER TABLE "Product"
  ALTER COLUMN "price" TYPE numeric(10,2) USING ROUND("price"::numeric, 2),
  ALTER COLUMN "salePrice" TYPE numeric(10,2) USING CASE
    WHEN "salePrice" IS NULL THEN NULL
    ELSE ROUND("salePrice"::numeric, 2)
  END,
  ALTER COLUMN "purchasePrice" TYPE numeric(10,2) USING CASE
    WHEN "purchasePrice" IS NULL THEN NULL
    ELSE ROUND("purchasePrice"::numeric, 2)
  END;

ALTER TABLE "Product"
  DROP COLUMN IF EXISTS "summary",
  DROP COLUMN IF EXISTS "description";

ALTER TABLE "Product"
  DROP CONSTRAINT IF EXISTS "chk_price_positive",
  DROP CONSTRAINT IF EXISTS "chk_rating_range";

ALTER TABLE "Product"
  ADD CONSTRAINT "chk_price_positive" CHECK ("price" > 0),
  ADD CONSTRAINT "chk_rating_range" CHECK ("rating" BETWEEN 0 AND 5);

ALTER TABLE "Product"
  DROP CONSTRAINT IF EXISTS "Product_brand_fkey",
  ADD CONSTRAINT "Product_brand_fkey"
    FOREIGN KEY ("brand") REFERENCES "Brand"("name")
    ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE "Product"
  DROP CONSTRAINT IF EXISTS "Product_supplier_fkey",
  ADD CONSTRAINT "Product_supplier_fkey"
    FOREIGN KEY ("supplier") REFERENCES "Supplier"("name")
    ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Product_supplier_idx" ON "Product"("supplier");

COMMIT;
