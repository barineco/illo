-- Add license and storage quota fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultLicense" VARCHAR(200);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "usedStorageBytes" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "storageQuotaBytes" BIGINT NOT NULL DEFAULT 1073741824;

-- Add license field to artworks table
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "license" VARCHAR(200);

-- Add new fields to artwork_images table for format preservation and metadata
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "originalStorageKey" VARCHAR(500);
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "originalFileSize" INTEGER;
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "originalFormat" VARCHAR(20) NOT NULL DEFAULT 'jpeg';
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "hasMetadata" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "wasResized" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "original_encryption_iv" VARCHAR(32);

-- Update comments for clarity
COMMENT ON COLUMN "users"."defaultLicense" IS 'Default license for artworks (e.g., "CC BY 4.0", "All Rights Reserved")';
COMMENT ON COLUMN "users"."usedStorageBytes" IS 'Total storage used by this user (in bytes)';
COMMENT ON COLUMN "users"."storageQuotaBytes" IS 'Storage quota (default: 1GB)';

COMMENT ON COLUMN "artworks"."license" IS 'Artwork-specific license (overrides user default)';

COMMENT ON COLUMN "artwork_images"."url" IS '2048px version (for detail page)';
COMMENT ON COLUMN "artwork_images"."thumbnailUrl" IS '320px version (for thumbnails)';
COMMENT ON COLUMN "artwork_images"."storageKey" IS 'Storage key for 2048px version';
COMMENT ON COLUMN "artwork_images"."originalStorageKey" IS 'Storage key for full-size version (if file size <= limit)';
COMMENT ON COLUMN "artwork_images"."fileSize" IS 'bytes (for 2048px version)';
COMMENT ON COLUMN "artwork_images"."originalFileSize" IS 'bytes (for full-size version, if exists)';
COMMENT ON COLUMN "artwork_images"."originalFormat" IS '"jpeg", "png", "gif", "webp", "svg"';
COMMENT ON COLUMN "artwork_images"."hasMetadata" IS 'Whether metadata was embedded';
COMMENT ON COLUMN "artwork_images"."wasResized" IS 'Whether the image was resized from original';
COMMENT ON COLUMN "artwork_images"."encryption_iv" IS 'Base64 encoded IV for 2048px';
COMMENT ON COLUMN "artwork_images"."original_encryption_iv" IS 'Base64 encoded IV for full-size';
COMMENT ON COLUMN "artwork_images"."thumbnail_encryption_iv" IS 'Base64 encoded IV for thumbnail';
