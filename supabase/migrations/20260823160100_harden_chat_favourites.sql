-- Harden chat favourites while preserving the historical relational contract from 003_chat_and_favourites.sql.
-- Current application clients consume a snapshot-shaped FavouriteRecord. These additive columns provide that
-- representation without rewriting deployed migration history, while message_id remains the canonical FK.
ALTER TABLE public.favourites
    ADD COLUMN IF NOT EXISTS item_type TEXT,
    ADD COLUMN IF NOT EXISTS item_payload JSONB,
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill the application-facing snapshot from the canonical message relation. Include the sender profile used
-- by FavouritesComponent while keeping the underlying message_id FK authoritative.
UPDATE public.favourites AS favourite
SET
    item_type = 'message',
    item_payload = to_jsonb(message_row) || jsonb_build_object(
        'sender',
        CASE
            WHEN sender.id IS NULL THEN NULL
            ELSE jsonb_build_object(
                'id', sender.id,
                'display_name', sender.display_name,
                'avatar_url', sender.avatar_url
            )
        END
    ),
    notes = favourite.note_text
FROM public.chat_messages AS message_row
LEFT JOIN public.users AS sender ON sender.id = message_row.sender_id
WHERE favourite.message_id = message_row.id
  AND (favourite.item_payload IS NULL OR favourite.item_type IS NULL OR favourite.notes IS DISTINCT FROM favourite.note_text);

ALTER TABLE public.favourites
    ALTER COLUMN item_type SET DEFAULT 'message';

CREATE OR REPLACE FUNCTION public.normalise_chat_favourite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    canonical_message_id UUID;
    canonical_room_id TEXT;
    canonical_payload JSONB;
BEGIN
    -- The old relational API supplies message_id while the newer /chat/favourites path supplies item_payload.id.
    -- Resolve both shapes onto the canonical FK and reject malformed identifiers before any write occurs.
    canonical_message_id := NEW.message_id;
    IF canonical_message_id IS NULL THEN
        BEGIN
            canonical_message_id := NULLIF(NEW.item_payload ->> 'id', '')::UUID;
        EXCEPTION
            WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'Favourite message identifier is invalid' USING ERRCODE = '22023';
        END;
    END IF;

    IF canonical_message_id IS NULL THEN
        RAISE EXCEPTION 'Favourite message identifier is required' USING ERRCODE = '23502';
    END IF;

    SELECT
        message_row.room_id::TEXT,
        to_jsonb(message_row) || jsonb_build_object(
            'sender',
            CASE
                WHEN sender.id IS NULL THEN NULL
                ELSE jsonb_build_object(
                    'id', sender.id,
                    'display_name', sender.display_name,
                    'avatar_url', sender.avatar_url
                )
            END
        )
    INTO canonical_room_id, canonical_payload
    FROM public.chat_messages AS message_row
    LEFT JOIN public.users AS sender ON sender.id = message_row.sender_id
    WHERE message_row.id = canonical_message_id;

    IF canonical_payload IS NULL THEN
        RAISE EXCEPTION 'Favourite message not found' USING ERRCODE = '23503';
    END IF;

    -- Service-role database access bypasses RLS, so membership must be enforced at the data boundary too.
    -- This prevents a caller who learns another message UUID from bookmarking content outside their rooms.
    IF NOT EXISTS (
        SELECT 1
        FROM public.chat_room_members AS member
        WHERE member.user_id = NEW.user_id
          AND member.room_id::TEXT = canonical_room_id
    ) THEN
        RAISE EXCEPTION 'Cannot favourite a message outside your rooms' USING ERRCODE = '42501';
    END IF;

    NEW.message_id := canonical_message_id;
    NEW.item_type := 'message';

    -- Never persist a reusable view-once media URL into favourites. Other fields are a canonical message snapshot
    -- used to review text and corrections without an N+1 profile lookup in the UI.
    IF COALESCE((canonical_payload ->> 'is_view_once')::BOOLEAN, FALSE) THEN
        canonical_payload := canonical_payload - 'media_url';
    END IF;
    NEW.item_payload := canonical_payload;

    NEW.note_text := NULLIF(BTRIM(COALESCE(NEW.note_text, NEW.notes, '')), '');
    NEW.notes := NEW.note_text;
    IF CHAR_LENGTH(COALESCE(NEW.note_text, '')) > 500 THEN
        RAISE EXCEPTION 'Favourite note must not exceed 500 characters' USING ERRCODE = '22001';
    END IF;

    -- Serialize retries for the same relationship. The historical UNIQUE(user_id, message_id) constraint remains
    -- the final concurrency guard; the early return makes ordinary retried POSTs idempotent instead of surfacing 500s.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(NEW.user_id::TEXT || ':' || canonical_message_id::TEXT, 0)
    );

    IF TG_OP = 'INSERT' AND EXISTS (
        SELECT 1
        FROM public.favourites AS existing
        WHERE existing.user_id = NEW.user_id
          AND existing.message_id = canonical_message_id
    ) THEN
        UPDATE public.favourites
        SET
            note_text = NEW.note_text,
            notes = NEW.notes,
            item_type = NEW.item_type,
            item_payload = NEW.item_payload
        WHERE user_id = NEW.user_id
          AND message_id = canonical_message_id;
        RETURN NULL;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalise_chat_favourite_before_write ON public.favourites;
CREATE TRIGGER normalise_chat_favourite_before_write
BEFORE INSERT OR UPDATE OF message_id, item_type, item_payload, note_text, notes
ON public.favourites
FOR EACH ROW
EXECUTE FUNCTION public.normalise_chat_favourite();

-- Keep the application-facing columns synchronized for already-existing rows while retaining the canonical
-- relational unique constraint and index from migration 003.
ALTER TABLE public.favourites
    ALTER COLUMN item_type SET NOT NULL;

COMMENT ON FUNCTION public.normalise_chat_favourite() IS
    'Canonicalises saved-message favourites, enforces room membership and note bounds, protects view-once media, and makes duplicate POST retries idempotent.';
