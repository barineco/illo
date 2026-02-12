-- CreateEnum: FanArtPermission
DO $$ BEGIN
    CREATE TYPE "FanArtPermission" AS ENUM ('EVERYONE', 'FOLLOWERS_ONLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add CHARACTER_FAN_ART to NotificationType enum
DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'CHARACTER_FAN_ART';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: original_characters
CREATE TABLE IF NOT EXISTS "original_characters" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "avatar_storage_key" VARCHAR(500),
    "avatar_url" VARCHAR(2048),
    "avatar_thumbnail_url" VARCHAR(2048),
    "allow_fan_art" BOOLEAN NOT NULL DEFAULT true,
    "fan_art_permission" "FanArtPermission" NOT NULL DEFAULT 'EVERYONE',
    "allow_r18" BOOLEAN NOT NULL DEFAULT false,
    "allow_commercial" BOOLEAN NOT NULL DEFAULT false,
    "require_credit" BOOLEAN NOT NULL DEFAULT true,
    "guidelines" TEXT,
    "reference_notes" TEXT,
    "reference_visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "tags" TEXT[],
    "fan_art_count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "original_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable: oc_reference_images
CREATE TABLE IF NOT EXISTS "oc_reference_images" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "storageKey" VARCHAR(500) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "thumbnailUrl" VARCHAR(2048),
    "caption" VARCHAR(200),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oc_reference_images_pkey" PRIMARY KEY ("id")
);

-- Add character_id column to artworks
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "character_id" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "original_characters_creatorId_idx" ON "original_characters"("creatorId");
CREATE INDEX IF NOT EXISTS "original_characters_allow_fan_art_fan_art_permission_idx" ON "original_characters"("allow_fan_art", "fan_art_permission");
CREATE INDEX IF NOT EXISTS "original_characters_createdAt_idx" ON "original_characters"("createdAt");
CREATE INDEX IF NOT EXISTS "oc_reference_images_characterId_idx" ON "oc_reference_images"("characterId");
CREATE INDEX IF NOT EXISTS "artworks_character_id_idx" ON "artworks"("character_id");

-- AddForeignKey: original_characters -> users
DO $$ BEGIN
    ALTER TABLE "original_characters" ADD CONSTRAINT "original_characters_creatorId_fkey"
        FOREIGN KEY ("creatorId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: oc_reference_images -> original_characters
DO $$ BEGIN
    ALTER TABLE "oc_reference_images" ADD CONSTRAINT "oc_reference_images_characterId_fkey"
        FOREIGN KEY ("characterId") REFERENCES "original_characters"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: artworks -> original_characters
DO $$ BEGIN
    ALTER TABLE "artworks" ADD CONSTRAINT "artworks_character_id_fkey"
        FOREIGN KEY ("character_id") REFERENCES "original_characters"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
