-- Harden the Private Parties trust boundary.
--
-- Private Parties are a VIP/Pro product capability and are created through the
-- authenticated NestJS API. The backend uses service_role, which bypasses RLS,
-- and performs the entitlement + invite validation before persisting the room.
-- Direct authenticated Supabase clients must therefore never be able to turn a
-- normal audio room into a private room or write an invite list themselves.
--
-- This migration is intentionally forward-only and mixed-version safe:
-- current backend requests continue to use service_role, while ordinary
-- authenticated clients retain direct access only to non-private room rows.

-- Keep invite state structurally consistent for all new/updated rows. NOT VALID
-- avoids blocking deployment if an old inconsistent row exists; PostgreSQL still
-- enforces the constraint for every row written after this migration. A later
-- data-audit migration can VALIDATE it once legacy rows have been reviewed.
ALTER TABLE public.audio_rooms
    DROP CONSTRAINT IF EXISTS audio_rooms_private_invites_valid;

ALTER TABLE public.audio_rooms
    ADD CONSTRAINT audio_rooms_private_invites_valid CHECK (
        (
            COALESCE(is_private, false) = false
            AND COALESCE(cardinality(invited_user_ids), 0) = 0
        )
        OR (
            is_private = true
            AND COALESCE(cardinality(invited_user_ids), 0) BETWEEN 1 AND 50
        )
    ) NOT VALID;

-- Authenticated direct clients may create only ordinary public rooms. Private
-- rooms must pass through NestJS so the VIP entitlement and invite-list checks
-- cannot be bypassed with a direct PostgREST/Supabase request.
DROP POLICY IF EXISTS audio_rooms_insert_own ON public.audio_rooms;
CREATE POLICY audio_rooms_insert_own ON public.audio_rooms
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = host_id
        AND COALESCE(is_private, false) = false
        AND COALESCE(cardinality(invited_user_ids), 0) = 0
    );

-- Preserve the established host/co-host mutation scope for public active rooms,
-- while preventing a direct client from escalating a room into Private Party
-- mode or attaching invitees. Private-room mutations remain backend-only.
DROP POLICY IF EXISTS audio_rooms_update_own ON public.audio_rooms;
CREATE POLICY audio_rooms_update_own ON public.audio_rooms
    FOR UPDATE TO authenticated
    USING (
        (auth.uid() = host_id OR auth.uid() = co_host_id)
        AND COALESCE(is_archived, false) = false
        AND COALESCE(is_private, false) = false
    )
    WITH CHECK (
        (auth.uid() = host_id OR auth.uid() = co_host_id)
        AND COALESCE(is_archived, false) = false
        AND COALESCE(is_private, false) = false
        AND COALESCE(cardinality(invited_user_ids), 0) = 0
    );

-- Re-state the visibility policy so this migration is self-contained: ordinary
-- rooms are discoverable to authenticated users; private rooms are visible only
-- to their host, co-host, invitees, or admins. The service_role backend continues
-- to bypass RLS as designed.
DROP POLICY IF EXISTS audio_rooms_select_authenticated ON public.audio_rooms;
CREATE POLICY audio_rooms_select_authenticated ON public.audio_rooms
    FOR SELECT TO authenticated USING (
        COALESCE(is_private, false) = false
        OR auth.uid() = host_id
        OR auth.uid() = co_host_id
        OR (
            invited_user_ids IS NOT NULL
            AND auth.uid() = ANY (invited_user_ids)
        )
        OR EXISTS (
            SELECT 1
            FROM public.users u
            WHERE u.id = auth.uid() AND u.is_admin = true
        )
    );

COMMENT ON CONSTRAINT audio_rooms_private_invites_valid ON public.audio_rooms IS
    'Private Parties require 1-50 invitees; public rooms cannot carry invite state.';
