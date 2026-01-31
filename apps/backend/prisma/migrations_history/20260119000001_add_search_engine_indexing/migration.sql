-- Add allow_search_engine_indexing column to instance_settings table
-- Default is false for privacy-first approach
ALTER TABLE "instance_settings" ADD COLUMN "allow_search_engine_indexing" BOOLEAN NOT NULL DEFAULT false;
