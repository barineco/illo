-- Add encryption metadata fields to artwork_images table
ALTER TABLE "artwork_images" ADD COLUMN "encryption_iv" VARCHAR(32);
ALTER TABLE "artwork_images" ADD COLUMN "is_encrypted" BOOLEAN NOT NULL DEFAULT false;
