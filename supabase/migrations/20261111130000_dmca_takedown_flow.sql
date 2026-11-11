-- DMCA notice-and-takedown flow (issue #2044).
--
-- Notices arrive through a public form, are confirmed by email, and then the
-- identified Moment or comment is disabled automatically, the owner is told how
-- to file a counter-notice, and the content is restored after the statutory
-- waiting period unless the claimant goes to court or an operator decides
-- otherwise.
--
-- Disabling blanks the content columns of the live row and stores the original
-- values in dmca_content_snapshots in the same transaction, so every existing
-- read path stops serving the material without being edited, and a restore puts
-- the exact original back. The row (with its likes and comments) is kept.
--
-- Retention
--   dmca_notices          closed notices: 3 years after closed_at, then deleted
--                         with their events and counter-notice; unconfirmed
--                         ('expired') notices: 30 days after creation.
--   dmca_content_snapshots deleted on restore, or when the target no longer
--                         exists (owner deletion or account erasure).
--
-- Rollback: DROP TRIGGER moment_comments_protect_dmca_disabled ON public.moment_comments;
--           DROP TRIGGER moments_protect_dmca_disabled ON public.moments;
--           DROP FUNCTION public.protect_dmca_disabled_content();
--           DROP FUNCTION public.dmca_orphaned_snapshots(INTEGER);
--           DROP FUNCTION public.dmca_restore_content(UUID, TEXT, UUID);
--           DROP FUNCTION public.dmca_disable_content(TEXT, UUID);
--           restore any disabled content first (the operator decision API does
--           this), then DROP TABLE public.dmca_notice_events,
--           public.dmca_counter_notices, public.dmca_content_snapshots,
--           public.dmca_notices; ALTER TABLE ... DROP COLUMN dmca_disabled_at.

ALTER TABLE public.moments
    ADD COLUMN IF NOT EXISTS dmca_disabled_at TIMESTAMPTZ;
ALTER TABLE public.moment_comments
    ADD COLUMN IF NOT EXISTS dmca_disabled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.dmca_notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT NOT NULL UNIQUE CHECK (reference ~ '^DMCA-[0-9A-Z]{10}$'),
    status TEXT NOT NULL DEFAULT 'pending_verification' CHECK (
        status IN (
            'pending_verification',
            'expired',
            'needs_review',
            'content_disabled',
            'counter_notice_received',
            'restored',
            'rejected',
            'withdrawn',
            'litigation_hold'
        )
    ),
    claimant_name TEXT NOT NULL CHECK (char_length(claimant_name) BETWEEN 2 AND 200),
    claimant_email TEXT NOT NULL CHECK (char_length(claimant_email) BETWEEN 5 AND 254),
    claimant_organisation TEXT CHECK (claimant_organisation IS NULL OR char_length(claimant_organisation) <= 200),
    claimant_address TEXT CHECK (claimant_address IS NULL OR char_length(claimant_address) <= 500),
    claimant_phone TEXT CHECK (claimant_phone IS NULL OR char_length(claimant_phone) <= 40),
    copyrighted_work TEXT NOT NULL CHECK (char_length(copyrighted_work) BETWEEN 10 AND 2000),
    material_reference TEXT NOT NULL CHECK (char_length(material_reference) BETWEEN 1 AND 2048),
    good_faith_statement BOOLEAN NOT NULL CHECK (good_faith_statement),
    accuracy_statement BOOLEAN NOT NULL CHECK (accuracy_statement),
    electronic_signature TEXT NOT NULL CHECK (char_length(electronic_signature) BETWEEN 2 AND 200),
    target_type TEXT CHECK (target_type IN ('moment', 'moment_comment')),
    target_id UUID,
    target_owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verification_token_hash TEXT CHECK (verification_token_hash IS NULL OR verification_token_hash ~ '^[0-9a-f]{64}$'),
    verification_expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    content_disabled_at TIMESTAMPTZ,
    counter_notice_at TIMESTAMPTZ,
    restore_after TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT dmca_notices_target_pair CHECK ((target_type IS NULL) = (target_id IS NULL))
);

-- Operator queue and owner listing.
CREATE INDEX IF NOT EXISTS dmca_notices_status_created_idx
    ON public.dmca_notices (status, created_at DESC);
CREATE INDEX IF NOT EXISTS dmca_notices_owner_created_idx
    ON public.dmca_notices (target_owner_id, created_at DESC)
    WHERE target_owner_id IS NOT NULL;
-- Strike counting, restore-eligibility checks and overlapping-notice lookups.
CREATE INDEX IF NOT EXISTS dmca_notices_target_active_idx
    ON public.dmca_notices (target_type, target_id)
    WHERE target_id IS NOT NULL
      AND status IN ('content_disabled', 'counter_notice_received', 'litigation_hold');
CREATE INDEX IF NOT EXISTS dmca_notices_owner_active_idx
    ON public.dmca_notices (target_owner_id, content_disabled_at)
    WHERE target_owner_id IS NOT NULL
      AND status IN ('content_disabled', 'counter_notice_received', 'litigation_hold');
-- Scheduled work.
CREATE INDEX IF NOT EXISTS dmca_notices_restore_due_idx
    ON public.dmca_notices (restore_after)
    WHERE status = 'counter_notice_received';
CREATE INDEX IF NOT EXISTS dmca_notices_unverified_expiry_idx
    ON public.dmca_notices (verification_expires_at)
    WHERE status = 'pending_verification' AND verified_at IS NULL;
CREATE INDEX IF NOT EXISTS dmca_notices_verified_unprocessed_idx
    ON public.dmca_notices (verified_at)
    WHERE status = 'pending_verification' AND verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS dmca_notices_closed_retention_idx
    ON public.dmca_notices (closed_at)
    WHERE closed_at IS NOT NULL;
-- Abuse control: notices per claimant mailbox per day. One emailed token
-- confirms every item of a single submission, so the token hash is shared by
-- those rows and indexed without a uniqueness requirement.
CREATE INDEX IF NOT EXISTS dmca_notices_claimant_created_idx
    ON public.dmca_notices (claimant_email, created_at DESC);
CREATE INDEX IF NOT EXISTS dmca_notices_verification_token_idx
    ON public.dmca_notices (verification_token_hash)
    WHERE verification_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.dmca_counter_notices (
    notice_id UUID PRIMARY KEY REFERENCES public.dmca_notices(id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 200),
    address TEXT NOT NULL CHECK (char_length(address) BETWEEN 5 AND 500),
    phone TEXT CHECK (phone IS NULL OR char_length(phone) <= 40),
    good_faith_statement BOOLEAN NOT NULL CHECK (good_faith_statement),
    jurisdiction_consent BOOLEAN NOT NULL CHECK (jurisdiction_consent),
    electronic_signature TEXT NOT NULL CHECK (char_length(electronic_signature) BETWEEN 2 AND 200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lifecycle trace for diagnosing a notice without database access. Events carry
-- a name and an actor, never free text, claimant details or content.
CREATE TABLE IF NOT EXISTS public.dmca_notice_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notice_id UUID NOT NULL REFERENCES public.dmca_notices(id) ON DELETE CASCADE,
    event TEXT NOT NULL CHECK (char_length(event) BETWEEN 3 AND 80),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('claimant', 'owner', 'operator', 'system')),
    actor_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dmca_notice_events_notice_idx
    ON public.dmca_notice_events (notice_id, created_at);

-- Original content of disabled material, keyed by target so overlapping
-- notices on the same item never overwrite the original with blanked values.
-- owner_id is deliberately not a foreign key (see the orphan sweep below).
CREATE TABLE IF NOT EXISTS public.dmca_content_snapshots (
    target_type TEXT NOT NULL CHECK (target_type IN ('moment', 'moment_comment')),
    target_id UUID NOT NULL,
    owner_id UUID NOT NULL,
    snapshot JSONB NOT NULL,
    media_state TEXT NOT NULL DEFAULT 'none' CHECK (
        media_state IN ('none', 'pending_quarantine', 'quarantined', 'pending_restore')
    ),
    media_objects JSONB NOT NULL DEFAULT '[]'::jsonb,
    restored_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (target_type, target_id)
);

CREATE INDEX IF NOT EXISTS dmca_content_snapshots_media_pending_idx
    ON public.dmca_content_snapshots (media_state, created_at)
    WHERE media_state IN ('pending_quarantine', 'pending_restore');

-- Disables one item atomically: snapshot the original, blank the live row.
-- Returns the original media references so the application can move the files.
-- Calling it again for an already-disabled item is a no-op.
CREATE OR REPLACE FUNCTION public.dmca_disable_content(
    p_target_type TEXT,
    p_target_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_moment public.moments%ROWTYPE;
    v_comment public.moment_comments%ROWTYPE;
    v_snapshot JSONB;
    v_media_state TEXT;
BEGIN
    IF p_target_type = 'moment' THEN
        SELECT * INTO v_moment FROM public.moments WHERE id = p_target_id FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('disabled', false);
        END IF;

        INSERT INTO public.dmca_content_snapshots (target_type, target_id, owner_id, snapshot)
        VALUES (
            'moment',
            v_moment.id,
            v_moment.user_id,
            jsonb_build_object(
                'text_content', v_moment.text_content,
                'media_urls', to_jsonb(v_moment.media_urls),
                'media_type', v_moment.media_type,
                'voice_note_url', v_moment.voice_note_url,
                'question_text', v_moment.question_text,
                'question_options', to_jsonb(v_moment.question_options),
                'correct_answer', v_moment.correct_answer
            )
        )
        ON CONFLICT (target_type, target_id) DO NOTHING;

        UPDATE public.moments
        SET text_content = NULL,
            media_urls = '{}',
            media_type = 'none',
            voice_note_url = NULL,
            question_text = NULL,
            question_options = '{}',
            correct_answer = NULL,
            dmca_disabled_at = COALESCE(dmca_disabled_at, now())
        WHERE id = p_target_id;

        SELECT s.snapshot, s.media_state INTO v_snapshot, v_media_state
        FROM public.dmca_content_snapshots s
        WHERE s.target_type = 'moment' AND s.target_id = p_target_id;

        RETURN jsonb_build_object(
            'disabled', true,
            'owner_id', v_moment.user_id,
            'media_state', v_media_state,
            'media_urls', COALESCE(v_snapshot -> 'media_urls', '[]'::jsonb),
            'voice_note_url', v_snapshot -> 'voice_note_url'
        );
    ELSIF p_target_type = 'moment_comment' THEN
        SELECT * INTO v_comment FROM public.moment_comments WHERE id = p_target_id FOR UPDATE;
        IF NOT FOUND THEN
            RETURN jsonb_build_object('disabled', false);
        END IF;

        INSERT INTO public.dmca_content_snapshots (target_type, target_id, owner_id, snapshot)
        VALUES (
            'moment_comment',
            v_comment.id,
            v_comment.user_id,
            jsonb_build_object(
                'text_content', v_comment.text_content,
                'correction_payload', v_comment.correction_payload
            )
        )
        ON CONFLICT (target_type, target_id) DO NOTHING;

        UPDATE public.moment_comments
        SET text_content = NULL,
            correction_payload = NULL,
            dmca_disabled_at = COALESCE(dmca_disabled_at, now())
        WHERE id = p_target_id;

        RETURN jsonb_build_object(
            'disabled', true,
            'owner_id', v_comment.user_id,
            'media_state', 'none',
            'media_urls', '[]'::jsonb,
            'voice_note_url', NULL
        );
    END IF;

    RAISE EXCEPTION 'unsupported DMCA target type' USING ERRCODE = '22023';
END;
$$;

-- Restores one item unless another live notice still covers it. The snapshot
-- survives while moved media files are still being returned.
CREATE OR REPLACE FUNCTION public.dmca_restore_content(
    p_notice_id UUID,
    p_target_type TEXT,
    p_target_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_snapshot public.dmca_content_snapshots%ROWTYPE;
    v_media_pending BOOLEAN;
BEGIN
    IF p_target_type NOT IN ('moment', 'moment_comment') THEN
        RAISE EXCEPTION 'unsupported DMCA target type' USING ERRCODE = '22023';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.dmca_notices n
        WHERE n.target_type = p_target_type
          AND n.target_id = p_target_id
          AND n.id <> p_notice_id
          AND n.status IN ('content_disabled', 'counter_notice_received', 'litigation_hold')
    ) THEN
        RETURN jsonb_build_object('restored', false, 'reason', 'other_active_notice');
    END IF;

    SELECT * INTO v_snapshot
    FROM public.dmca_content_snapshots s
    WHERE s.target_type = p_target_type AND s.target_id = p_target_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('restored', false, 'reason', 'no_snapshot');
    END IF;

    IF p_target_type = 'moment' THEN
        UPDATE public.moments
        SET text_content = v_snapshot.snapshot ->> 'text_content',
            media_urls = COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(v_snapshot.snapshot -> 'media_urls')),
                '{}'
            ),
            media_type = COALESCE(v_snapshot.snapshot ->> 'media_type', 'none'),
            voice_note_url = v_snapshot.snapshot ->> 'voice_note_url',
            question_text = v_snapshot.snapshot ->> 'question_text',
            question_options = COALESCE(
                ARRAY(SELECT jsonb_array_elements_text(v_snapshot.snapshot -> 'question_options')),
                '{}'
            ),
            correct_answer = v_snapshot.snapshot ->> 'correct_answer',
            dmca_disabled_at = NULL
        WHERE id = p_target_id;
    ELSE
        UPDATE public.moment_comments
        SET text_content = v_snapshot.snapshot ->> 'text_content',
            correction_payload = v_snapshot.snapshot -> 'correction_payload',
            dmca_disabled_at = NULL
        WHERE id = p_target_id;
    END IF;

    v_media_pending := v_snapshot.media_state IN ('pending_quarantine', 'quarantined', 'pending_restore');
    IF v_media_pending THEN
        UPDATE public.dmca_content_snapshots
        SET media_state = 'pending_restore', restored_at = COALESCE(restored_at, now())
        WHERE target_type = p_target_type AND target_id = p_target_id;
    ELSE
        DELETE FROM public.dmca_content_snapshots
        WHERE target_type = p_target_type AND target_id = p_target_id;
    END IF;

    RETURN jsonb_build_object('restored', true, 'media_pending', v_media_pending);
END;
$$;

-- Snapshots whose item has since been deleted (by the owner, or by account
-- erasure) must not outlive it. The application removes the quarantined files
-- and then the row.
CREATE OR REPLACE FUNCTION public.dmca_orphaned_snapshots(p_limit INTEGER)
RETURNS TABLE (target_type TEXT, target_id UUID, media_objects JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.target_type, s.target_id, s.media_objects
    FROM public.dmca_content_snapshots s
    WHERE (
        s.target_type = 'moment'
        AND NOT EXISTS (SELECT 1 FROM public.moments m WHERE m.id = s.target_id)
    ) OR (
        s.target_type = 'moment_comment'
        AND NOT EXISTS (SELECT 1 FROM public.moment_comments c WHERE c.id = s.target_id)
    )
    ORDER BY s.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

-- users_update_own style policies let owners edit their own Moments and
-- comments straight through PostgREST, which would let them undo a takedown.
-- Browser roles therefore cannot modify disabled content or the disabled
-- marker; the backend (service_role) and these functions are trusted.
CREATE OR REPLACE FUNCTION public.protect_dmca_disabled_content()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF current_user NOT IN ('anon', 'authenticated') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.dmca_disabled_at := NULL;
        RETURN NEW;
    END IF;

    IF OLD.dmca_disabled_at IS NOT NULL
       OR NEW.dmca_disabled_at IS DISTINCT FROM OLD.dmca_disabled_at THEN
        RAISE EXCEPTION 'content disabled by a copyright notice cannot be modified'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_dmca_disabled_content()
    FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS moments_protect_dmca_disabled ON public.moments;
CREATE TRIGGER moments_protect_dmca_disabled
    BEFORE INSERT OR UPDATE ON public.moments
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_dmca_disabled_content();

DROP TRIGGER IF EXISTS moment_comments_protect_dmca_disabled ON public.moment_comments;
CREATE TRIGGER moment_comments_protect_dmca_disabled
    BEFORE INSERT OR UPDATE ON public.moment_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_dmca_disabled_content();

REVOKE ALL ON FUNCTION public.dmca_disable_content(TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dmca_restore_content(UUID, TEXT, UUID)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dmca_orphaned_snapshots(INTEGER)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dmca_disable_content(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.dmca_restore_content(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.dmca_orphaned_snapshots(INTEGER) TO service_role;

ALTER TABLE public.dmca_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dmca_counter_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dmca_notice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dmca_content_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.dmca_notices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.dmca_counter_notices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.dmca_notice_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.dmca_content_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dmca_notices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dmca_counter_notices TO service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.dmca_notice_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.dmca_content_snapshots TO service_role;

COMMENT ON TABLE public.dmca_notices IS
    'One row per identified item in a DMCA takedown notice. Holds claimant contact details (personal data): retained 3 years after closure.';
COMMENT ON TABLE public.dmca_content_snapshots IS
    'Original content of items disabled by a DMCA notice, kept only until the item is restored or deleted.';
COMMENT ON TABLE public.dmca_notice_events IS
    'Event name and actor only. Never stores free text, claimant details or content.';
COMMENT ON COLUMN public.moments.dmca_disabled_at IS
    'Set while the Moment is disabled by a DMCA notice; its content columns are blanked and held in dmca_content_snapshots.';
COMMENT ON COLUMN public.moment_comments.dmca_disabled_at IS
    'Set while the comment is disabled by a DMCA notice; its content is held in dmca_content_snapshots.';
