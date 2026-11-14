-- UI locale used by backend-rendered copy (push notifications, system chat
-- rows). The browser stores its selected locale locally; this column lets the
-- API address a recipient in the language they last chose.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS ui_locale TEXT NOT NULL DEFAULT 'en-GB';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_ui_locale_length_check'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_ui_locale_length_check
      CHECK (char_length(ui_locale) BETWEEN 2 AND 35);
  END IF;
END
$$;

COMMENT ON COLUMN public.users.ui_locale IS
  'BCP-47 UI locale last selected by the user; backend copy falls back to en-GB.';
