-- Remove Original Characters (OCs) feature
-- Production data confirmed: 0 rows in all OC-related tables

-- Step 1: Drop foreign key constraints (children first)
ALTER TABLE "character_reference_artworks" DROP CONSTRAINT IF EXISTS "character_reference_artworks_characterId_fkey";
ALTER TABLE "character_reference_artworks" DROP CONSTRAINT IF EXISTS "character_reference_artworks_artworkId_fkey";
ALTER TABLE "character_reference_artworks" DROP CONSTRAINT IF EXISTS "character_reference_artworks_characterId_artworkId_key";
ALTER TABLE "artworks" DROP CONSTRAINT IF EXISTS "artworks_character_id_fkey";
ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_characterId_fkey";
ALTER TABLE "original_characters" DROP CONSTRAINT IF EXISTS "original_characters_creatorId_fkey";
ALTER TABLE "original_characters" DROP CONSTRAINT IF EXISTS "original_characters_representative_artwork_id_fkey";

-- Step 2: Drop indexes
DROP INDEX IF EXISTS "artworks_character_id_idx";
DROP INDEX IF EXISTS "notifications_characterId_idx";
DROP INDEX IF EXISTS "character_reference_artworks_characterId_idx";
DROP INDEX IF EXISTS "character_reference_artworks_artworkId_idx";
DROP INDEX IF EXISTS "character_reference_artworks_order_idx";
DROP INDEX IF EXISTS "original_characters_creatorId_idx";
DROP INDEX IF EXISTS "original_characters_allow_fan_art_fan_art_permission_idx";
DROP INDEX IF EXISTS "original_characters_createdAt_idx";
DROP INDEX IF EXISTS "original_characters_representative_artwork_id_idx";

-- Step 3: Drop columns from existing tables
ALTER TABLE "artworks" DROP COLUMN IF EXISTS "character_id";
ALTER TABLE "notifications" DROP COLUMN IF EXISTS "characterId";

-- Step 4: Drop tables (children first)
DROP TABLE IF EXISTS "character_reference_artworks";
DROP TABLE IF EXISTS "original_characters";

-- Step 5: Remove CHARACTER_FAN_ART from NotificationType enum
DO $$ BEGIN
  DELETE FROM pg_enum WHERE enumlabel = 'CHARACTER_FAN_ART'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Step 6: Drop FanArtPermission enum
DROP TYPE IF EXISTS "FanArtPermission";
