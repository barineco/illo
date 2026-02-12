-- Refactor OriginalCharacter to use artwork references instead of direct uploads
-- This migration:
-- 1. Adds representative_artwork_id to original_characters
-- 2. Creates character_reference_artworks table (like collection_artworks)
-- 3. Removes avatar columns from original_characters
-- 4. Drops oc_reference_images table

-- Step 1: Add representative_artwork_id column
ALTER TABLE "original_characters" ADD COLUMN IF NOT EXISTS "representative_artwork_id" TEXT;

-- Step 2: Create index for representative_artwork_id
CREATE INDEX IF NOT EXISTS "original_characters_representative_artwork_id_idx" ON "original_characters"("representative_artwork_id");

-- Step 3: Add foreign key for representative_artwork_id
DO $$ BEGIN
    ALTER TABLE "original_characters" ADD CONSTRAINT "original_characters_representative_artwork_id_fkey"
        FOREIGN KEY ("representative_artwork_id") REFERENCES "artworks"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 4: Create character_reference_artworks table
CREATE TABLE IF NOT EXISTS "character_reference_artworks" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "caption" VARCHAR(200),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "character_reference_artworks_pkey" PRIMARY KEY ("id")
);

-- Step 5: Create unique constraint on character_reference_artworks
DO $$ BEGIN
    ALTER TABLE "character_reference_artworks" ADD CONSTRAINT "character_reference_artworks_characterId_artworkId_key"
        UNIQUE ("characterId", "artworkId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 6: Create indexes for character_reference_artworks
CREATE INDEX IF NOT EXISTS "character_reference_artworks_characterId_idx" ON "character_reference_artworks"("characterId");
CREATE INDEX IF NOT EXISTS "character_reference_artworks_artworkId_idx" ON "character_reference_artworks"("artworkId");
CREATE INDEX IF NOT EXISTS "character_reference_artworks_order_idx" ON "character_reference_artworks"("order");

-- Step 7: Add foreign keys for character_reference_artworks
DO $$ BEGIN
    ALTER TABLE "character_reference_artworks" ADD CONSTRAINT "character_reference_artworks_characterId_fkey"
        FOREIGN KEY ("characterId") REFERENCES "original_characters"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "character_reference_artworks" ADD CONSTRAINT "character_reference_artworks_artworkId_fkey"
        FOREIGN KEY ("artworkId") REFERENCES "artworks"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 8: Remove old avatar columns from original_characters (if they exist)
ALTER TABLE "original_characters" DROP COLUMN IF EXISTS "avatar_storage_key";
ALTER TABLE "original_characters" DROP COLUMN IF EXISTS "avatar_url";
ALTER TABLE "original_characters" DROP COLUMN IF EXISTS "avatar_thumbnail_url";

-- Step 9: Drop old oc_reference_images table (if exists)
DROP TABLE IF EXISTS "oc_reference_images";
