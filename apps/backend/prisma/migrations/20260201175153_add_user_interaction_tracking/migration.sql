-- ============================================
-- User Interaction Tracking
-- ============================================
-- Add user interaction signal to headless browser detection
-- Tracks mouse/touch/keyboard events to distinguish real users from bots

-- Add userInteractionWeight to headless_detection_config
ALTER TABLE "headless_detection_config"
ADD COLUMN IF NOT EXISTS "userInteractionWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0;

-- Add userInteractionScore to headless_detection_logs
ALTER TABLE "headless_detection_logs"
ADD COLUMN IF NOT EXISTS "userInteractionScore" INTEGER NOT NULL DEFAULT 0;
