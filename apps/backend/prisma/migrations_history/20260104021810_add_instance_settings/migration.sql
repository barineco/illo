-- CreateEnum
CREATE TYPE "InstanceMode" AS ENUM ('PERSONAL', 'FEDERATION_ONLY', 'FULL_FEDIVERSE');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "instance_settings" (
    "id" TEXT NOT NULL,
    "instanceName" VARCHAR(100) NOT NULL,
    "instanceMode" "InstanceMode" NOT NULL DEFAULT 'PERSONAL',
    "isSetupComplete" BOOLEAN NOT NULL DEFAULT false,
    "adminUserId" TEXT,
    "allowRegistration" BOOLEAN NOT NULL DEFAULT false,
    "requireApproval" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instance_settings_adminUserId_key" ON "instance_settings"("adminUserId");
