-- Update ToS fields: remove all text fields (content is now managed via source files)
-- AlterTable
ALTER TABLE "instance_settings" DROP COLUMN IF EXISTS "tos_url";
ALTER TABLE "instance_settings" DROP COLUMN IF EXISTS "privacy_url";
ALTER TABLE "instance_settings" DROP COLUMN IF EXISTS "tos_text";
ALTER TABLE "instance_settings" DROP COLUMN IF EXISTS "privacy_text";
