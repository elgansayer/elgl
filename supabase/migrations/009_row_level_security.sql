-- Defence-in-depth Row Level Security (RLS) policies.
--
-- The NestJS backend is the only client that talks to Supabase (see AGENTS.md
-- "API First" mandate) and it authenticates using the service_role key, which
-- always bypasses RLS. These policies do not change backend behaviour; they
-- exist so that a leaked anon/authenticated key, a future direct-to-Supabase
-- client, or the Supabase Studio table editor cannot read or mutate rows
-- outside of the owning user's scope (OWASP A01: Broken Access Control).

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select_authenticated ON public.users
    FOR SELECT TO authenticated USING (true);
CREATE POLICY users_update_own ON public.users
    FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- profile_visits
ALTER TABLE public.profile_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_visits_select_own ON public.profile_visits
    FOR SELECT TO authenticated USING (auth.uid() = viewed_id OR auth.uid() = visitor_id);
CREATE POLICY profile_visits_insert_own ON public.profile_visits
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = visitor_id);

-- blocks
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocks_select_own ON public.blocks
    FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY blocks_insert_own ON public.blocks
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY blocks_delete_own ON public.blocks
    FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_select_own ON public.reports
    FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY reports_insert_own ON public.reports
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- chat_messages (no room-membership table exists yet, so SELECT is scoped to
-- the sender only; broaden this once a chat_room_participants table lands)
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_messages_select_own ON public.chat_messages
    FOR SELECT TO authenticated USING (auth.uid() = sender_id);
CREATE POLICY chat_messages_insert_own ON public.chat_messages
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- favourites
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
CREATE POLICY favourites_select_own ON public.favourites
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY favourites_insert_own ON public.favourites
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY favourites_delete_own ON public.favourites
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- flashcards
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY flashcards_all_own ON public.flashcards
    FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- moments (public timeline content, mutation restricted to the author)
ALTER TABLE public.moments ENABLE ROW LEVEL SECURITY;
CREATE POLICY moments_select_authenticated ON public.moments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY moments_insert_own ON public.moments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY moments_update_own ON public.moments
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY moments_delete_own ON public.moments
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- moment_likes
ALTER TABLE public.moment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY moment_likes_select_authenticated ON public.moment_likes
    FOR SELECT TO authenticated USING (true);
CREATE POLICY moment_likes_insert_own ON public.moment_likes
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY moment_likes_delete_own ON public.moment_likes
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- moment_comments
ALTER TABLE public.moment_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY moment_comments_select_authenticated ON public.moment_comments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY moment_comments_insert_own ON public.moment_comments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY moment_comments_delete_own ON public.moment_comments
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- user_follows
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_follows_select_authenticated ON public.user_follows
    FOR SELECT TO authenticated USING (true);
CREATE POLICY user_follows_insert_own ON public.user_follows
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY user_follows_delete_own ON public.user_follows
    FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- audio_rooms (public listing, mutation restricted to the host)
ALTER TABLE public.audio_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY audio_rooms_select_authenticated ON public.audio_rooms
    FOR SELECT TO authenticated USING (true);
CREATE POLICY audio_rooms_insert_own ON public.audio_rooms
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = host_id);
CREATE POLICY audio_rooms_update_own ON public.audio_rooms
    FOR UPDATE TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

-- audio_room_captions
ALTER TABLE public.audio_room_captions ENABLE ROW LEVEL SECURITY;
CREATE POLICY audio_room_captions_select_authenticated ON public.audio_room_captions
    FOR SELECT TO authenticated USING (true);
CREATE POLICY audio_room_captions_insert_own ON public.audio_room_captions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = speaker_id);

-- virtual_gifts (read-only catalogue, no client-side mutation)
ALTER TABLE public.virtual_gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY virtual_gifts_select_authenticated ON public.virtual_gifts
    FOR SELECT TO authenticated USING (true);

-- gift_transactions
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY gift_transactions_select_own ON public.gift_transactions
    FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY gift_transactions_insert_own ON public.gift_transactions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);

-- safety_reports
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY safety_reports_select_own ON public.safety_reports
    FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY safety_reports_insert_own ON public.safety_reports
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- user_blocks
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_blocks_select_own ON public.user_blocks
    FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY user_blocks_insert_own ON public.user_blocks
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY user_blocks_delete_own ON public.user_blocks
    FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- developer_metrics / developer_diagnostic_logs (developer-only diagnostics)
ALTER TABLE public.developer_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY developer_metrics_select_own ON public.developer_metrics
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.developer_diagnostic_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY developer_diagnostic_logs_select_own ON public.developer_diagnostic_logs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- chat_rooms (local dev seed metadata, read-only for clients)
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_rooms_select_authenticated ON public.chat_rooms
    FOR SELECT TO authenticated USING (true);
