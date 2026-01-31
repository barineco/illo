-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'UNLISTED', 'FOLLOWERS_ONLY', 'PRIVATE');

-- AlterTable
ALTER TABLE "artworks" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "instance_settings" ADD COLUMN     "federatedInstances" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "defaultVisibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "federationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "federated_instances" (
    "id" TEXT NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "softwareName" VARCHAR(100),
    "softwareVersion" VARCHAR(50),
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "federated_instances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "federated_instances_domain_key" ON "federated_instances"("domain");

-- CreateIndex
CREATE INDEX "federated_instances_domain_idx" ON "federated_instances"("domain");

-- CreateIndex
CREATE INDEX "federated_instances_isTrusted_idx" ON "federated_instances"("isTrusted");

-- CreateIndex
CREATE INDEX "federated_instances_isBlocked_idx" ON "federated_instances"("isBlocked");

-- CreateIndex
CREATE INDEX "artworks_visibility_idx" ON "artworks"("visibility");
