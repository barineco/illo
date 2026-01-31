-- Add useProfileToolsAsDefault column to users table
-- This setting controls whether profile tools are pre-selected when uploading artworks

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "use_profile_tools_as_default" BOOLEAN NOT NULL DEFAULT true;
