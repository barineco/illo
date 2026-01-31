-- CreateEnum
CREATE TYPE "RateLimitTier" AS ENUM ('NORMAL', 'WARNING', 'SOFT_LIMIT', 'HARD_LIMIT');

-- CreateTable
CREATE TABLE "rate_limit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" VARCHAR(45) NOT NULL,
    "endpoint" VARCHAR(100) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "tier" "RateLimitTier" NOT NULL DEFAULT 'NORMAL',
    "requestCount" INTEGER NOT NULL,
    "windowSize" INTEGER NOT NULL,
    "intervalVariance" DOUBLE PRECISION,
    "avgInterval" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_penalties" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" VARCHAR(45) NOT NULL,
    "tier" "RateLimitTier" NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "violationCount" INTEGER NOT NULL DEFAULT 1,
    "escalatedFrom" TEXT,

    CONSTRAINT "rate_limit_penalties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_config" (
    "id" TEXT NOT NULL,
    "windowSeconds" INTEGER NOT NULL DEFAULT 30,
    "softLimitPerWindow" INTEGER NOT NULL DEFAULT 8,
    "hardLimitPerWindow" INTEGER NOT NULL DEFAULT 12,
    "softLimitPerHour" INTEGER NOT NULL DEFAULT 150,
    "hardLimitPerHour" INTEGER NOT NULL DEFAULT 250,
    "cvSoftThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "cvHardThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "softPenaltyMinutes" INTEGER NOT NULL DEFAULT 5,
    "hardPenaltyMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxPenaltyMinutes" INTEGER NOT NULL DEFAULT 120,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "rate_limit_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rate_limit_logs_userId_createdAt_idx" ON "rate_limit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_logs_ipAddress_createdAt_idx" ON "rate_limit_logs"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_logs_tier_createdAt_idx" ON "rate_limit_logs"("tier", "createdAt");

-- CreateIndex
CREATE INDEX "rate_limit_penalties_userId_idx" ON "rate_limit_penalties"("userId");

-- CreateIndex
CREATE INDEX "rate_limit_penalties_ipAddress_idx" ON "rate_limit_penalties"("ipAddress");

-- CreateIndex
CREATE INDEX "rate_limit_penalties_expiresAt_idx" ON "rate_limit_penalties"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_penalties_userId_ipAddress_key" ON "rate_limit_penalties"("userId", "ipAddress");

-- AddForeignKey
ALTER TABLE "rate_limit_logs" ADD CONSTRAINT "rate_limit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limit_penalties" ADD CONSTRAINT "rate_limit_penalties_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
