-- Add social links and Bluesky OAuth fields to users table
ALTER TABLE "users" ADD COLUMN "social_links" JSONB;
ALTER TABLE "users" ADD COLUMN "bluesky_did" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "bluesky_handle" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "bluesky_verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "bluesky_linked_at" TIMESTAMP(3);

-- Add unique constraint for bluesky_did
CREATE UNIQUE INDEX "users_bluesky_did_key" ON "users"("bluesky_did");
