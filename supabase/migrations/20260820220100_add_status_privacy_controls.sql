-- Ensure the user-level presence and VIP visibility controls exist on every
-- environment. These columns may already exist in long-lived environments;
-- ADD COLUMN IF NOT EXISTS keeps the migration safe to replay.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS privacy_hide_online_status boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_hide_vip_status boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.privacy_hide_online_status IS
  'When true, public member-facing surfaces must not expose this user as online or recently active.';

COMMENT ON COLUMN public.users.privacy_hide_vip_status IS
  'When true, member-facing surfaces must not expose this user VIP badge/status; entitlement remains unchanged.';
