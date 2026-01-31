-- Add composite score fields to rate_limit_config table
-- These fields enable the new pattern-based detection algorithm

-- Composite score thresholds
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "hardLimitScore" DOUBLE PRECISION NOT NULL DEFAULT 90;
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "softLimitScore" DOUBLE PRECISION NOT NULL DEFAULT 50;
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "warningScore" DOUBLE PRECISION NOT NULL DEFAULT 35;

-- Minimum sample size for pattern analysis
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "minSamplesAnonymous" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "minSamplesUser" INTEGER NOT NULL DEFAULT 20;

-- Instant detection (for obvious automation)
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "instantDetectionIntervalMs" INTEGER NOT NULL DEFAULT 3000;
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "instantDetectionCV" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- Rollout control
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "measurementMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "rate_limit_config" ADD COLUMN IF NOT EXISTS "useCompositeScore" BOOLEAN NOT NULL DEFAULT false;

-- Add composite score fields to rate_limit_logs table
-- These fields record the new algorithm's analysis results

ALTER TABLE "rate_limit_logs" ADD COLUMN IF NOT EXISTS "riskScore" DOUBLE PRECISION;
ALTER TABLE "rate_limit_logs" ADD COLUMN IF NOT EXISTS "intervalScore" DOUBLE PRECISION;
ALTER TABLE "rate_limit_logs" ADD COLUMN IF NOT EXISTS "regularityScore" DOUBLE PRECISION;
ALTER TABLE "rate_limit_logs" ADD COLUMN IF NOT EXISTS "detectionReason" VARCHAR(50);
ALTER TABLE "rate_limit_logs" ADD COLUMN IF NOT EXISTS "isAnonymous" BOOLEAN NOT NULL DEFAULT true;
