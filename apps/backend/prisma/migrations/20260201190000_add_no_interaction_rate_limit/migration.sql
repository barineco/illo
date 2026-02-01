-- ============================================
-- No Interaction Rate Limit Integration
-- ============================================
-- Add settings to apply stricter rate limits when no real user interaction detected
-- Integrates headless browser detection with rate limiting

-- Add noInteraction settings to rate_limit_config
ALTER TABLE "rate_limit_config"
ADD COLUMN IF NOT EXISTS "no_interaction_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "no_interaction_threshold_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- Add hasRealInteraction to rate_limit_logs for tracking
ALTER TABLE "rate_limit_logs"
ADD COLUMN IF NOT EXISTS "has_real_interaction" BOOLEAN;
