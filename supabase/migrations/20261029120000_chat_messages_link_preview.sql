-- Issue #1717: persist rich link previews with the chat message they describe.
--
-- ChatService resolves the OpenGraph preview of the first URL in a text message
-- (docs/rich-link-previews.md) but only published it over Centrifugo. A client
-- that loaded history later, which includes every recipient who was offline
-- when the message was sent, never received the card. The preview is now stored
-- on the message row and returned by the history, search and export reads.
--
-- Rollout: additive and safe with mixed application versions. The column is
-- nullable with no default, so existing rows are untouched and older instances
-- ignore it. The backend writes it best effort, so deploying the application
-- before this migration only means previews are absent from history until the
-- column exists. Roll back by reverting the application; the column can stay.
--
-- Retention: the preview lives and dies with its message row. Delete for
-- everyone, disappearing-message purges and account deletion hard-delete the
-- row, so there is nothing separate to expire or clean up.
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS link_preview JSONB;

-- Authenticated clients may still insert their own messages under the legacy
-- defence-in-depth RLS policy, even though the Angular application is API
-- first. Do not let that path forge metadata which appears to have been
-- fetched and sanitised by the backend. This restrictive policy is combined
-- with the existing membership policy; the backend service role bypasses RLS
-- and remains the only writer of a non-null preview.
DROP POLICY IF EXISTS chat_messages_link_preview_backend_only
  ON public.chat_messages;
CREATE POLICY chat_messages_link_preview_backend_only
  ON public.chat_messages
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (link_preview IS NULL);

-- The application bounds every field (title 300, description 1,000 and site
-- name 200 characters, plus two URLs of at most 2,048), so a real preview stays
-- well under 16 KiB. The constraint only stops a faulty writer bloating history
-- responses. It is added NOT VALID and validated separately so a large table is
-- never held under a long exclusive lock, and it is guarded so the migration
-- can be re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.chat_messages'::regclass
       AND conname = 'chat_messages_link_preview_check'
  ) THEN
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_link_preview_check
      CHECK (
        link_preview IS NULL
        OR (
          jsonb_typeof(link_preview) = 'object'
          AND octet_length(link_preview::text) <= 16384
        )
      ) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.chat_messages
  VALIDATE CONSTRAINT chat_messages_link_preview_check;

COMMENT ON COLUMN public.chat_messages.link_preview IS
  'Bounded OpenGraph preview (url, title, description, image, siteName) of the first http(s) URL in a text message. Written only by the backend after the scraper has sanitised it, revalidated against the current message text on every read, and removed with the message row.';
