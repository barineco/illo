-- CreateTable
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "coverImageUrl" VARCHAR(500),
    "artworkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collection_artworks" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_artworks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collections_userId_idx" ON "collections"("userId");

-- CreateIndex
CREATE INDEX "collections_visibility_idx" ON "collections"("visibility");

-- CreateIndex
CREATE INDEX "collections_createdAt_idx" ON "collections"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "collection_artworks_collectionId_artworkId_key" ON "collection_artworks"("collectionId", "artworkId");

-- CreateIndex
CREATE INDEX "collection_artworks_collectionId_idx" ON "collection_artworks"("collectionId");

-- CreateIndex
CREATE INDEX "collection_artworks_artworkId_idx" ON "collection_artworks"("artworkId");

-- CreateIndex
CREATE INDEX "collection_artworks_order_idx" ON "collection_artworks"("order");

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_artworks" ADD CONSTRAINT "collection_artworks_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_artworks" ADD CONSTRAINT "collection_artworks_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "artworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
