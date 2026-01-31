-- Add REACTION to NotificationType enum (idempotent: check if exists first)
DO $$ BEGIN
    ALTER TYPE "NotificationType" ADD VALUE 'REACTION';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create reactions table for emoji reactions (supports both logged-in and anonymous users)
CREATE TABLE IF NOT EXISTS "reactions" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "emoji" VARCHAR(64) NOT NULL,
    "userId" TEXT,
    "ipHash" VARCHAR(64),
    "apActivityId" TEXT,
    "federated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- Create anonymous_reaction_limits table for rate limiting
CREATE TABLE IF NOT EXISTS "anonymous_reaction_limits" (
    "id" TEXT NOT NULL,
    "ipHash" VARCHAR(64) NOT NULL,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anonymous_reaction_limits_pkey" PRIMARY KEY ("id")
);

-- Add reactionId column to notifications table
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "reactionId" TEXT;

-- Add reactionCount column to artworks table
ALTER TABLE "artworks" ADD COLUMN IF NOT EXISTS "reactionCount" INTEGER NOT NULL DEFAULT 0;

-- Create unique index for apActivityId
CREATE UNIQUE INDEX IF NOT EXISTS "reactions_apActivityId_key" ON "reactions"("apActivityId");

-- Create unique constraint for user reactions (same user can only react once with same emoji per artwork)
CREATE UNIQUE INDEX IF NOT EXISTS "user_artwork_emoji" ON "reactions"("artworkId", "userId", "emoji");

-- Create unique constraint for anonymous reactions (same IP can only react once with same emoji per artwork)
CREATE UNIQUE INDEX IF NOT EXISTS "ip_artwork_emoji" ON "reactions"("artworkId", "ipHash", "emoji");

-- Create indexes for reactions table
CREATE INDEX IF NOT EXISTS "reactions_artworkId_idx" ON "reactions"("artworkId");
CREATE INDEX IF NOT EXISTS "reactions_userId_idx" ON "reactions"("userId");
CREATE INDEX IF NOT EXISTS "reactions_ipHash_idx" ON "reactions"("ipHash");
CREATE INDEX IF NOT EXISTS "reactions_emoji_idx" ON "reactions"("emoji");
CREATE INDEX IF NOT EXISTS "reactions_createdAt_idx" ON "reactions"("createdAt");

-- Create unique index for ipHash in anonymous_reaction_limits
CREATE UNIQUE INDEX IF NOT EXISTS "anonymous_reaction_limits_ipHash_key" ON "anonymous_reaction_limits"("ipHash");

-- Create index for expiresAt in anonymous_reaction_limits
CREATE INDEX IF NOT EXISTS "anonymous_reaction_limits_expiresAt_idx" ON "anonymous_reaction_limits"("expiresAt");

-- Create unique index for reactionId in notifications
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_reactionId_key" ON "notifications"("reactionId");

-- Add foreign key constraints (idempotent: catch duplicate errors)
DO $$ BEGIN
    ALTER TABLE "reactions" ADD CONSTRAINT "reactions_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "reactions" ADD CONSTRAINT "reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reactionId_fkey" FOREIGN KEY ("reactionId") REFERENCES "reactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
