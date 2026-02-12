-- Add characterId column to notifications
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "characterId" TEXT;

-- Create index for characterId
CREATE INDEX IF NOT EXISTS "notifications_characterId_idx" ON "notifications"("characterId");

-- Add foreign key constraint
DO $$ BEGIN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_characterId_fkey"
        FOREIGN KEY ("characterId") REFERENCES "original_characters"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
