-- Drop old username unique constraint (conflicts with composite username+domain unique)
DROP INDEX IF EXISTS "users_username_key";
