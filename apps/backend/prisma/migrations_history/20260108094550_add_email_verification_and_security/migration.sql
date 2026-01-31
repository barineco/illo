-- AlterTable: Add email verification fields
ALTER TABLE "users" ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "emailVerifyToken" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "emailVerifyExpires" TIMESTAMP(3);

-- AlterTable: Add password reset fields
ALTER TABLE "users" ADD COLUMN "resetPasswordToken" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "resetPasswordExpires" TIMESTAMP(3);

-- AlterTable: Add security fields
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "loginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "lockoutUntil" TIMESTAMP(3);

-- CreateIndex: Add unique constraint for emailVerifyToken
CREATE UNIQUE INDEX "users_emailVerifyToken_key" ON "users"("emailVerifyToken");

-- CreateIndex: Add unique constraint for resetPasswordToken
CREATE UNIQUE INDEX "users_resetPasswordToken_key" ON "users"("resetPasswordToken");
