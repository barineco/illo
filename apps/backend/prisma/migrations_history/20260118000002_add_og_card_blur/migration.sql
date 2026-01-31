-- Add og_card_blur column to artworks table for Link Card blur setting
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "og_card_blur" BOOLEAN NOT NULL DEFAULT false;
