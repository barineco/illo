-- Add soft delete fields to artworks table
ALTER TABLE "artworks" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "artworks" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Create index for filtering deleted artworks
CREATE INDEX "artworks_is_deleted_idx" ON "artworks"("is_deleted");
