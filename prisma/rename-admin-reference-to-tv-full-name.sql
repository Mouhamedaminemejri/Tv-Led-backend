BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'Product'
      AND column_name = 'adminReference'
  ) THEN
    ALTER TABLE "Product" RENAME COLUMN "adminReference" TO "tvFullName";
  END IF;
END $$;

COMMIT;
