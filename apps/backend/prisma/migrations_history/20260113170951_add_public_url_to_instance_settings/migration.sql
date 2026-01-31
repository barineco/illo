-- Add publicUrl field to instance_settings
ALTER TABLE "instance_settings" ADD COLUMN "publicUrl" VARCHAR(500);

-- Set default publicUrl from BASE_URL env var for existing instances
-- This will be updated during the next setup or via admin panel
UPDATE "instance_settings" SET "publicUrl" = 'http://localhost:11103' WHERE "publicUrl" IS NULL;
