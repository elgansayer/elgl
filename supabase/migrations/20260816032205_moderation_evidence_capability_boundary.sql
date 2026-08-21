-- Keep cross-user moderation evidence reads behind the capability-gated backend.
-- Legacy dashboard RLS added users.is_admin branches directly to authenticated
-- browser policies, bypassing moderation/audit authorization in the NestJS API.
-- Existing normal-user visibility is preserved below.

DROP POLICY IF EXISTS profile_visits_select_own ON public.profile_visits;
CREATE POLICY profile_visits_select_own ON public.profile_visits
  FOR SELECT TO authenticated
  USING (auth.uid() = viewed_id OR auth.uid() = visitor_id);

DROP POLICY IF EXISTS chat_messages_select_own ON public.chat_messages;
CREATE POLICY chat_messages_select_own ON public.chat_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS gift_transactions_select_own ON public.gift_transactions;
CREATE POLICY gift_transactions_select_own ON public.gift_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS favourites_select_own ON public.favourites;
CREATE POLICY favourites_select_own ON public.favourites
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS message_reactions_select_admin
  ON public.message_reactions;
DROP POLICY IF EXISTS coin_purchases_select_admin
  ON public.coin_purchases;
