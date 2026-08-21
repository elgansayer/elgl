-- Add proficiency_level column to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS proficiency_level VARCHAR(2);

-- Add CHECK constraint (skip if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_proficiency_level_check'
    AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_proficiency_level_check
      CHECK (proficiency_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2'));
  END IF;
END $$;