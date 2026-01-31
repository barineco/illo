-- Add NSFW to AgeRating enum (before R18)
ALTER TYPE "AgeRating" ADD VALUE 'NSFW' BEFORE 'R18';

-- Create BirthdayDisplay enum
CREATE TYPE "BirthdayDisplay" AS ENUM ('HIDDEN', 'MONTH_DAY', 'FULL_DATE');

-- Add age verification and content settings fields to users table
ALTER TABLE "users" ADD COLUMN "birthday" DATE;
ALTER TABLE "users" ADD COLUMN "birthday_display" "BirthdayDisplay" NOT NULL DEFAULT 'HIDDEN';
ALTER TABLE "users" ADD COLUMN "age_verified_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "content_filters" JSONB;

-- Create index on age_verified_at for filtering
CREATE INDEX "users_age_verified_at_idx" ON "users"("age_verified_at");
