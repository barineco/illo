-- Add disable_right_click column to artworks table
ALTER TABLE "artworks" ADD COLUMN "disable_right_click" BOOLEAN NOT NULL DEFAULT true;
