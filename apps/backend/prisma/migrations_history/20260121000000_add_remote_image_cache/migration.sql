-- CreateEnum (IF NOT EXISTS for idempotency)
DO $$ BEGIN
    CREATE TYPE "RemoteImageCacheStatus" AS ENUM ('NOT_CACHED', 'CACHING', 'CACHED', 'CACHE_FAILED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable: InstanceSettings - Add remote image cache settings
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "remote_image_cache_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "remote_image_cache_ttl_days" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "remote_image_auto_cache" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: InstanceSettings - Add priority-based cache settings
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "cache_priority_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "cache_priority_threshold" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "cache_ttl_multiplier_tier1" DOUBLE PRECISION NOT NULL DEFAULT 1.5;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "cache_ttl_multiplier_tier2" DOUBLE PRECISION NOT NULL DEFAULT 2.0;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "cache_ttl_multiplier_tier3" DOUBLE PRECISION NOT NULL DEFAULT 3.0;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "cache_like_tier1" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "cache_like_tier2" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "cache_like_tier3" INTEGER NOT NULL DEFAULT 100;

-- AlterTable: Users - Add avatar cache fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_cache_status" "RemoteImageCacheStatus";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_cached_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_cache_expires_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cached_avatar_url" VARCHAR(500);

-- AlterTable: ArtworkImages - Add remote image cache fields
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "cache_status" "RemoteImageCacheStatus";
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "cached_at" TIMESTAMP(3);
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "cache_expires_at" TIMESTAMP(3);
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "remote_url" VARCHAR(1000);
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "original_width" INTEGER;
ALTER TABLE "artwork_images" ADD COLUMN IF NOT EXISTS "original_height" INTEGER;

-- CreateIndex (IF NOT EXISTS for idempotency)
CREATE INDEX IF NOT EXISTS "artwork_images_cache_status_idx" ON "artwork_images"("cache_status");
