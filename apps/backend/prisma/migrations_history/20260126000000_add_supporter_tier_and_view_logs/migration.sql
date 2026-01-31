-- Add SupporterTier enum and Patreon integration fields to users
-- Add ViewLog table for analytics

-- Create SupporterTier enum (idempotent)
DO $$ BEGIN
    CREATE TYPE "SupporterTier" AS ENUM ('NONE', 'TIER_1', 'TIER_2', 'TIER_3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add supporter tier fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supporter_tier" "SupporterTier" NOT NULL DEFAULT 'NONE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supporter_since" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "supporter_expires_at" TIMESTAMP(3);

-- Add Patreon OAuth fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "patreon_id" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "patreon_access_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "patreon_refresh_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "patreon_token_expires_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "patreon_last_sync_at" TIMESTAMP(3);

-- Add unique constraint for patreon_id (idempotent)
DO $$ BEGIN
    ALTER TABLE "users" ADD CONSTRAINT "users_patreon_id_key" UNIQUE ("patreon_id");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ViewLog table for analytics (idempotent)
CREATE TABLE IF NOT EXISTS "view_logs" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "viewerId" TEXT,
    "visitorHash" VARCHAR(64),
    "referrer" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "view_logs_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints for view_logs (idempotent)
DO $$ BEGIN
    ALTER TABLE "view_logs" ADD CONSTRAINT "view_logs_artworkId_fkey"
        FOREIGN KEY ("artworkId") REFERENCES "artworks"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "view_logs" ADD CONSTRAINT "view_logs_viewerId_fkey"
        FOREIGN KEY ("viewerId") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes for view_logs (idempotent)
CREATE INDEX IF NOT EXISTS "view_logs_artworkId_createdAt_idx" ON "view_logs"("artworkId", "createdAt");
CREATE INDEX IF NOT EXISTS "view_logs_artworkId_visitorHash_idx" ON "view_logs"("artworkId", "visitorHash");
CREATE INDEX IF NOT EXISTS "view_logs_createdAt_idx" ON "view_logs"("createdAt");
