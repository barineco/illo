-- CreateEnum
CREATE TYPE "ActivityDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "activity_delivery_logs" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "inboxUrl" VARCHAR(500) NOT NULL,
    "activityType" VARCHAR(50) NOT NULL,
    "activityId" VARCHAR(500),
    "activityPayload" JSONB NOT NULL,
    "status" "ActivityDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 4,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "bullmqJobId" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "activity_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_delivery_logs_bullmqJobId_key" ON "activity_delivery_logs"("bullmqJobId");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_senderId_idx" ON "activity_delivery_logs"("senderId");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_status_idx" ON "activity_delivery_logs"("status");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_activityType_idx" ON "activity_delivery_logs"("activityType");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_createdAt_idx" ON "activity_delivery_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_delivery_logs_inboxUrl_idx" ON "activity_delivery_logs"("inboxUrl");
