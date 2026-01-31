-- WebAuthn / Passkey Authentication
-- Add authenticators table for storing WebAuthn credentials

CREATE TABLE IF NOT EXISTS "authenticators" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" BYTEA NOT NULL,
    "credentialPublicKey" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "credentialDeviceType" VARCHAR(32) NOT NULL,
    "credentialBackedUp" BOOLEAN NOT NULL,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "authenticators_pkey" PRIMARY KEY ("id")
);

-- WebAuthn Challenge table for temporary challenge storage
CREATE TABLE IF NOT EXISTS "webauthn_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "challenge" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

-- Create unique index on credentialId
CREATE UNIQUE INDEX IF NOT EXISTS "authenticators_credentialId_key" ON "authenticators"("credentialId");

-- Create index on userId for faster lookups
CREATE INDEX IF NOT EXISTS "authenticators_userId_idx" ON "authenticators"("userId");

-- Create unique index on challenge
CREATE UNIQUE INDEX IF NOT EXISTS "webauthn_challenges_challenge_key" ON "webauthn_challenges"("challenge");

-- Create index on expiresAt for cleanup queries
CREATE INDEX IF NOT EXISTS "webauthn_challenges_expiresAt_idx" ON "webauthn_challenges"("expiresAt");

-- Add foreign key constraint (IF NOT EXISTS via DO block)
DO $$ BEGIN
    ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
