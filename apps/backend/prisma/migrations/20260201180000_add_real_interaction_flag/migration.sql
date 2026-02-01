-- ============================================
-- Real User Interaction Tracking
-- ============================================
-- Add hasRealInteraction field to track actual DOM events
-- (mouse, touch, keyboard) vs automated page visits

-- Add hasRealInteraction to headless_detection_logs
ALTER TABLE "headless_detection_logs"
ADD COLUMN IF NOT EXISTS "hasRealInteraction" BOOLEAN NOT NULL DEFAULT false;
