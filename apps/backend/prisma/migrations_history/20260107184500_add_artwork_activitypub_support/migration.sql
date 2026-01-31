-- AlterTable
ALTER TABLE "artworks" ADD COLUMN     "apObjectId" TEXT,
ADD COLUMN     "federated" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "artworks_apObjectId_key" ON "artworks"("apObjectId");
