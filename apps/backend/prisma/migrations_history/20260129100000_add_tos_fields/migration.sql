-- Add Terms of Service fields to instance_settings and users tables
-- Migration: 20260129100000_add_tos_fields

-- ============================================
-- InstanceSettings: ToS configuration
-- ============================================

-- ToS URL (external link to terms)
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "tos_url" VARCHAR(500);

-- ToS text (custom terms text, markdown supported)
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "tos_text" TEXT;

-- ToS version (increment when terms change to require re-acceptance)
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "tos_version" INTEGER NOT NULL DEFAULT 1;

-- ToS last updated timestamp
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "tos_updated_at" TIMESTAMP(3);

-- Privacy policy URL
ALTER TABLE "instance_settings" ADD COLUMN IF NOT EXISTS "privacy_url" VARCHAR(500);

-- ============================================
-- Users: ToS acceptance tracking
-- ============================================

-- When user accepted ToS
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tos_accepted_at" TIMESTAMP(3);

-- Which version of ToS was accepted
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tos_accepted_version" INTEGER;
