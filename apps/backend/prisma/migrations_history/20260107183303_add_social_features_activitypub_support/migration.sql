-- CreateEnum
CREATE TYPE "FollowStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "bookmarks" DROP COLUMN "isPublic";

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "apActivityId" TEXT,
ADD COLUMN     "federated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "follows" ADD COLUMN     "apActivityId" TEXT,
ADD COLUMN     "federated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "FollowStatus" NOT NULL DEFAULT 'ACCEPTED';

-- AlterTable
ALTER TABLE "likes" ADD COLUMN     "apActivityId" TEXT,
ADD COLUMN     "federated" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "comments_apActivityId_key" ON "comments"("apActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "follows_apActivityId_key" ON "follows"("apActivityId");

-- CreateIndex
CREATE INDEX "follows_status_idx" ON "follows"("status");

-- CreateIndex
CREATE UNIQUE INDEX "likes_apActivityId_key" ON "likes"("apActivityId");
