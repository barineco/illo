-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_username_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "domain" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_domain_key" ON "users"("username", "domain");
