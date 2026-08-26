-- Harden the canonical CEFR proficiency-level contract introduced by
-- 20260807000000_add_proficiency_level_to_users.sql.
--
-- Mixed-version safety:
-- - existing supported lower/mixed-case values are normalized to the canonical
--   uppercase CEFR representation used by the API and profile UI;
-- - unexpected values fail the migration instead of being silently discarded;
-- - NULL remains valid so profiles that have not selected/completed a level are
--   not assigned an invented proficiency.

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_proficiency_level_check;

UPDATE public.users
SET proficiency_level = upper(btrim(proficiency_level))
WHERE proficiency_level IS NOT NULL
  AND upper(btrim(proficiency_level)) IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  AND proficiency_level IS DISTINCT FROM upper(btrim(proficiency_level));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.users
    WHERE proficiency_level IS NOT NULL
      AND proficiency_level NOT IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ) THEN
    RAISE EXCEPTION 'users.proficiency_level contains unsupported values; repair data before retrying migration'
      USING ERRCODE = '23514';
  END IF;
END
$$;

ALTER TABLE public.users
  ALTER COLUMN proficiency_level TYPE varchar(2)
  USING proficiency_level::varchar(2);

ALTER TABLE public.users
  ADD CONSTRAINT users_proficiency_level_check
  CHECK (
    proficiency_level IS NULL
    OR proficiency_level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
  ) NOT VALID;

ALTER TABLE public.users
  VALIDATE CONSTRAINT users_proficiency_level_check;

COMMENT ON COLUMN public.users.proficiency_level IS
  'Optional canonical CEFR proficiency level: A1, A2, B1, B2, C1, or C2.';
