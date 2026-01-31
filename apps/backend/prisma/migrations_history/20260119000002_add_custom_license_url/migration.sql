-- Add custom_license_url column to artworks table for custom license URLs
ALTER TABLE "artworks" ADD COLUMN "custom_license_url" VARCHAR(500);
