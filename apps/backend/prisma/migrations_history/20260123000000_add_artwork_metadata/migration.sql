-- Add ENUM types for artwork metadata
DO $$ BEGIN
    CREATE TYPE "CreationPeriodUnit" AS ENUM ('HOURS', 'DAYS', 'WEEKS', 'MONTHS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ArtworkMedium" AS ENUM ('DIGITAL', 'TRADITIONAL', 'THREE_D', 'MIXED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add metadata columns to artworks table
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "creation_date" TIMESTAMP(3);
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "creation_period_value" INTEGER;
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "creation_period_unit" "CreationPeriodUnit";
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "is_commission" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "client_name" VARCHAR(200);
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "project_name" VARCHAR(200);
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "medium" "ArtworkMedium";
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "external_url" VARCHAR(500);
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "tools_used" TEXT;

-- Add tools_used column to users table (for profile tools list)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tools_used" TEXT;

-- Create index for creation_date sorting
CREATE INDEX IF NOT EXISTS "artworks_creation_date_idx" ON "artworks"("creation_date");
