-- ============================================
-- Headless Browser Detection
-- ============================================
-- Add headless browser detection tables for anti-scraping protection
-- Detects Puppeteer, Playwright, and other headless browsers using
-- multiple signals (User-Agent, Client Hints, HTTP headers)

-- Headless Detection Configuration Table
CREATE TABLE IF NOT EXISTS "headless_detection_config" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "measurementMode" BOOLEAN NOT NULL DEFAULT true,
    "suspiciousThreshold" INTEGER NOT NULL DEFAULT 31,
    "likelyBotThreshold" INTEGER NOT NULL DEFAULT 51,
    "definiteBotThreshold" INTEGER NOT NULL DEFAULT 76,
    "userAgentWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "clientHintsWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "headerWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "rateLimitWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "suspiciousAction" VARCHAR(20) NOT NULL DEFAULT 'log_only',
    "likelyBotAction" VARCHAR(20) NOT NULL DEFAULT 'degrade',
    "definiteBotAction" VARCHAR(20) NOT NULL DEFAULT 'block',
    "allowedUserAgents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedIpRanges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "headless_detection_config_pkey" PRIMARY KEY ("id")
);

-- Headless Detection Log Table
CREATE TABLE IF NOT EXISTS "headless_detection_logs" (
    "id" TEXT NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "userId" TEXT,
    "totalScore" INTEGER NOT NULL,
    "verdict" VARCHAR(20) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "userAgentScore" INTEGER NOT NULL,
    "clientHintsScore" INTEGER NOT NULL,
    "headerScore" INTEGER NOT NULL,
    "rateLimitScore" INTEGER NOT NULL,
    "userAgent" TEXT,
    "rawHeaders" JSONB,
    "detectionReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionTaken" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "headless_detection_logs_pkey" PRIMARY KEY ("id")
);

-- Create indexes for headless_detection_logs
CREATE INDEX IF NOT EXISTS "headless_detection_logs_ipAddress_createdAt_idx"
    ON "headless_detection_logs"("ipAddress", "createdAt");

CREATE INDEX IF NOT EXISTS "headless_detection_logs_verdict_createdAt_idx"
    ON "headless_detection_logs"("verdict", "createdAt");

CREATE INDEX IF NOT EXISTS "headless_detection_logs_totalScore_createdAt_idx"
    ON "headless_detection_logs"("totalScore", "createdAt");
