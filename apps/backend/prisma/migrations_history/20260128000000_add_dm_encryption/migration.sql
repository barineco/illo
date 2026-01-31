-- Add DM encryption support (MLS over ActivityPub)
-- Migration for message encryption and MLS KeyPackage management
-- Following idempotency best practices per MIGRATION_GUIDE.md

-- Add encryption columns to messages table
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "encryption_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "content_iv" VARCHAR(24);

-- Create MLS KeyPackages table for E2E encryption
CREATE TABLE IF NOT EXISTS "mls_key_packages" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyPackage" BYTEA NOT NULL,
    "publicKey" VARCHAR(100) NOT NULL,
    "cipherSuite" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "mls_key_packages_pkey" PRIMARY KEY ("id")
);

-- Create MLS Group States table for group continuity
CREATE TABLE IF NOT EXISTS "mls_group_states" (
    "id" TEXT NOT NULL,
    "groupId" VARCHAR(100) NOT NULL,
    "epochNumber" INTEGER NOT NULL DEFAULT 0,
    "groupState" BYTEA NOT NULL,
    "participantIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mls_group_states_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on groupId
CREATE UNIQUE INDEX IF NOT EXISTS "mls_group_states_groupId_key" ON "mls_group_states"("groupId");

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS "mls_key_packages_userId_idx" ON "mls_key_packages"("userId");
CREATE INDEX IF NOT EXISTS "mls_key_packages_publicKey_idx" ON "mls_key_packages"("publicKey");
CREATE INDEX IF NOT EXISTS "mls_group_states_groupId_idx" ON "mls_group_states"("groupId");

-- Add foreign key constraint (idempotent with DO block)
DO $$ BEGIN
    ALTER TABLE "mls_key_packages"
        ADD CONSTRAINT "mls_key_packages_userId_fkey"
        FOREIGN KEY ("userId")
        REFERENCES "users"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
