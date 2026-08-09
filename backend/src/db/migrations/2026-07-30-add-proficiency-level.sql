-- Add proficiency_level column to users table
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "proficiency_level" VARCHAR(2) NULL;
