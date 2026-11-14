-- Contact sharing consent and profile fields.
--
-- Members can share verified auth contact details only with mutual follows or
-- someone sharing an active chat room, and only when they have not hidden
-- contact exchange.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS contact_social_handle TEXT,
  ADD COLUMN IF NOT EXISTS privacy_hide_contact BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_contact_social_handle_length_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_contact_social_handle_length_check
      CHECK (
        contact_social_handle IS NULL
        OR char_length(contact_social_handle) BETWEEN 2 AND 61
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.users.contact_social_handle IS
  'Optional social handle the owner may share explicitly; never returned unless requested.';
COMMENT ON COLUMN public.users.privacy_hide_contact IS
  'When true, contact sharing requests are refused for this account.';
