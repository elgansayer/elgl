-- Materialize the discovery profile columns already consumed by DiscoveryService
-- and 20260808000003_optimise_discovery_indices.sql.
--
-- Historical environments may already have these columns through schema drift,
-- so keep the convergence migration idempotent.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS interests VARCHAR(50)[];

COMMENT ON COLUMN public.users.country IS
  'Country used by discovery filtering and VIP location-spoofing presentation.';
COMMENT ON COLUMN public.users.city IS
  'City used by discovery filtering and VIP location-spoofing presentation.';
COMMENT ON COLUMN public.users.interests IS
  'Discovery interest tags used by array-overlap partner filtering.';
