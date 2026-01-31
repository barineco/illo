-- Add OG card crop coordinates to Artwork table
-- These store the crop region for link card generation from the first artwork image
-- Null values mean center crop (default behavior)

ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "og_card_crop_x" INTEGER;
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "og_card_crop_y" INTEGER;
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "og_card_crop_width" INTEGER;
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "og_card_crop_height" INTEGER;
