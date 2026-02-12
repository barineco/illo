-- Add CopyrightType enum (idempotent)
DO $$ BEGIN
    CREATE TYPE "CopyrightType" AS ENUM ('CREATOR', 'COMMISSION', 'LICENSED', 'CORPORATE', 'FAN_ART', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add copyright fields to artworks table (idempotent)
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "copyright_holder" VARCHAR(200);
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "copyright_type" "CopyrightType" DEFAULT 'CREATOR';
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "copyright_note" TEXT;

-- Add original creator fields to artworks table (idempotent)
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "original_creator_id" TEXT;
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "original_creator_allow_download" BOOLEAN DEFAULT false;

-- Add foreign key constraint for original_creator_id (idempotent)
DO $$ BEGIN
    ALTER TABLE "artworks" ADD CONSTRAINT "artworks_original_creator_id_fkey"
    FOREIGN KEY ("original_creator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add index for original_creator_id (idempotent)
CREATE INDEX IF NOT EXISTS "artworks_original_creator_id_idx" ON "artworks"("original_creator_id");
