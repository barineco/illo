-- AlterTable
ALTER TABLE "users" ADD COLUMN "pendingEmail" VARCHAR(255),
ADD COLUMN "emailChangeToken" VARCHAR(255),
ADD COLUMN "emailChangeExpires" TIMESTAMP(3),
ADD COLUMN "hasSetPassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "users_emailChangeToken_key" ON "users"("emailChangeToken");

-- Backfill: email登録ユーザーは自分でパスワードを設定している
UPDATE "users" SET "hasSetPassword" = true WHERE "email" IS NOT NULL;
