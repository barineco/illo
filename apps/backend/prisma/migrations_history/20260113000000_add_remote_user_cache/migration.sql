-- Add remote user cache fields to User table

-- Add followers and following URLs (ActivityPub collections)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "followers_url" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "following_url" VARCHAR(500);

-- Add shared inbox URL for efficient federation
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "shared_inbox" VARCHAR(500);

-- Add summary field (bio from remote instance)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "summary" TEXT;

-- Add cache metadata
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_fetched_at" TIMESTAMP;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "fetch_error_count" INTEGER DEFAULT 0;

-- Add indexes for remote user queries
CREATE INDEX IF NOT EXISTS "idx_users_domain" ON "users"("domain") WHERE "domain" != '';
CREATE INDEX IF NOT EXISTS "idx_users_last_fetched" ON "users"("last_fetched_at") WHERE "domain" != '';

-- Add comment
COMMENT ON COLUMN "users"."domain" IS 'Empty string for local users, domain name for remote users';
COMMENT ON COLUMN "users"."last_fetched_at" IS 'Last time remote user data was fetched from origin server';
COMMENT ON COLUMN "users"."fetch_error_count" IS 'Number of consecutive fetch errors for this remote user';
