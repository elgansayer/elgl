-- #1810: support bounded interest filtering in Discovery with an index that
-- matches PostgREST's array-overlap operator on public.users.interests.
--
-- This is additive and safe for mixed-version deployments. Older application
-- versions ignore the index, while newer versions benefit immediately.

CREATE INDEX IF NOT EXISTS users_interests_gin_idx
  ON public.users USING GIN (interests)
  WHERE interests IS NOT NULL;

COMMENT ON INDEX public.users_interests_gin_idx IS
  'GIN index for Discovery interest-tag overlap filtering.';
