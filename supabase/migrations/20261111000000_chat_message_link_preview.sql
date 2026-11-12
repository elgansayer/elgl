-- Persist the OpenGraph link preview with the chat message it describes (#1678)
--
-- LinkPreviewService resolves the first URL of a text message once, on the
-- server, when the message is sent, edited or forwarded. Until now the result
-- was only attached to the realtime publication, so reloading a room, an
-- offline recipient, a reconnecting client and a member who joins later all saw
-- the bare URL instead of the card the live recipients saw. Storing the preview
-- on the message row makes every history read render the same card without any
-- viewer-triggered outbound scrape.
--
-- Shape (written only by the backend, already sanitised and bounded by the
-- scraper):
--   { "url": text, "title": text, "description": text,
--     "image": text, "siteName": text }
-- NULL means the message has no preview. Existing rows keep NULL, so there is
-- no backfill, no table rewrite and no index: the column is only ever read as
-- part of the message row, never filtered on.
--
-- Retention and deletion: the preview shares the lifecycle of its message row.
-- Delete-for-everyone, disappearing-message expiry and account erasure delete
-- the row and therefore the preview. An edit replaces or clears it in the same
-- statement as the new text.
--
-- Rollback: the column is additive and ignored by older application versions.
-- Dropping it (ALTER TABLE ... DROP COLUMN link_preview) only removes the
-- stored cards; no other behaviour depends on it.

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS link_preview JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chat_messages_link_preview_shape'
       AND conrelid = 'public.chat_messages'::regclass
  ) THEN
    -- NOT VALID: every existing row has a NULL preview, so the check already
    -- holds for all of them and a validating scan of this hot table (under the
    -- lock the ALTER already holds) would only add write downtime. The
    -- constraint is enforced for every insert and update from now on.
    --
    -- The 16 KiB bound matches the scraper's own cache-entry bound, and a
    -- preview is never stored for an end-to-end encrypted message, so the link
    -- of an encrypted conversation cannot leak into a plaintext column.
    --
    -- COALESCE matters: a missing "url" key makes jsonb_typeof(...) NULL, and a
    -- CHECK treats NULL as satisfied, which would let a preview without a
    -- destination through.
    ALTER TABLE public.chat_messages
      ADD CONSTRAINT chat_messages_link_preview_shape
      CHECK (
        link_preview IS NULL
        OR (
          NOT is_encrypted
          AND jsonb_typeof(link_preview) = 'object'
          AND COALESCE(jsonb_typeof(link_preview -> 'url'), '') = 'string'
          AND octet_length(link_preview::text) <= 16384
        )
      ) NOT VALID;
  END IF;
END
$$;

COMMENT ON COLUMN public.chat_messages.link_preview IS
  'Bounded OpenGraph preview (url, title, description, image, siteName) of the first URL in a plaintext text message; NULL when the message has none. Replaced or cleared when the message is edited and deleted with the row.';
