-- Add device fingerprint score to headless detection logs
ALTER TABLE "headless_detection_logs" ADD COLUMN IF NOT EXISTS "deviceFingerprintScore" INTEGER NOT NULL DEFAULT 0;
