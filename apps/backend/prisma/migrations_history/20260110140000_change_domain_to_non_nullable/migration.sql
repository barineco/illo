-- Update existing NULL domains to empty string (local users)
UPDATE "users" SET "domain" = '' WHERE "domain" IS NULL;

-- AlterTable: Change domain from nullable to non-nullable with default empty string
ALTER TABLE "users" ALTER COLUMN "domain" SET DEFAULT '', ALTER COLUMN "domain" SET NOT NULL;
