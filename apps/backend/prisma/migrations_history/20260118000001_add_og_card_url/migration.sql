-- Add og_card_url column to artworks table for Open Graph card images
ALTER TABLE "artworks" ADD COLUMN "og_card_url" VARCHAR(500);
