-- Issue #1112: learning_goals is a free-text profile motivation field.
--
-- A matchmaking migration historically introduced learning_goals as TEXT[]. The
-- application contract has since treated it as a single bounded string, which
-- made profile updates fail against clean/current databases. Converge the schema
-- without rewriting deployed migration history and preserve legacy array values
-- as readable comma-separated text.

DO $$
DECLARE
  learning_goals_udt TEXT;
BEGIN
  SELECT c.udt_name
    INTO learning_goals_udt
  FROM information_schema.columns AS c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'users'
    AND c.column_name = 'learning_goals';

  IF learning_goals_udt IS NULL THEN
    ALTER TABLE public.users ADD COLUMN learning_goals TEXT;
  ELSIF learning_goals_udt = '_text' THEN
    EXECUTE $sql$
      ALTER TABLE public.users
      ALTER COLUMN learning_goals TYPE TEXT
      USING CASE
        WHEN learning_goals IS NULL THEN NULL
        ELSE array_to_string(learning_goals, ', ')
      END
    $sql$;
  ELSIF learning_goals_udt <> 'text' THEN
    EXECUTE $sql$
      ALTER TABLE public.users
      ALTER COLUMN learning_goals TYPE TEXT
      USING learning_goals::text
    $sql$;
  END IF;
END $$;

-- New/updated values must follow the same 1000-character API bound. Keep the
-- constraint NOT VALID during mixed-version rollout so unexpected historical
-- data cannot block deployment; PostgreSQL still enforces it for new writes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_learning_goals_length_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_learning_goals_length_check
      CHECK (learning_goals IS NULL OR char_length(learning_goals) <= 1000)
      NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.users.learning_goals IS
  'Optional free-text language-learning motivations, max 1000 characters for new/updated rows.';
