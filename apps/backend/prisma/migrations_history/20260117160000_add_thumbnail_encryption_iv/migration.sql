-- Add thumbnail_encryption_iv column to artwork_images table
-- This allows thumbnails to be encrypted with their own IV (separate from original image)

ALTER TABLE "artwork_images" ADD COLUMN "thumbnail_encryption_iv" VARCHAR(32);
