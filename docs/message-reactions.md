# Message reactions

Issue: #1160

## Product behaviour

Authenticated members of a chat room can add or remove one of six lightweight reactions on any non-deleted message: ❤️, 😂, 👍, 😮, 😢, or 🙏. Reactions are independent, so a user may react with more than one supported emoji. Repeating the same desired state is idempotent.

The chat view loads reaction state in one bounded request for the latest 100 messages rather than issuing a request per message. Each message exposes the six quick actions and aggregated counts. The current user's state is represented with `aria-pressed`, controls use touch-sized Spartan buttons, and mutation controls are disabled while that message has an update in flight. A failed reaction update leaves the previous authoritative state visible and shows the existing generic error message without blocking chat.

## API

All endpoints require the existing Supabase bearer authentication guard.

- `GET /chat/messages/room/:roomId/reactions` returns `{ reactions: Record<messageId, Array<{ user_id, emoji }>> }` for at most the newest 100 non-deleted messages. The caller must be a member of the room.
- `PUT /chat/messages/:messageId/reaction` accepts `{ emoji, active }`. `emoji` is restricted to the six supported values and `active` is an explicit boolean desired state. The caller must be a member of the message's room.

Reaction mutations are rate limited. Adding uses the existing `(message_id, user_id, emoji)` unique key with an upsert, so retries cannot create duplicate reactions. Removing an absent reaction is also successful. The server returns the complete authoritative state for that message after each mutation.

## Realtime and failure behaviour

After persistence, the backend publishes a `reaction` event on the existing `chat:<roomId>` Centrifugo channel. Persistence is authoritative: if Centrifugo is temporarily unavailable, the API still succeeds and clients recover the correct reaction state on the next room load. Provider failures are logged without message text, emoji history, tokens, or other private conversation content.

The initial Angular integration updates the acting client's state directly from the mutation response. Other connected clients can consume the published event as their realtime chat pipeline evolves; a reload always reconciles from Supabase through the authenticated API.

## Security and privacy

The original `message_reactions` migration allowed every authenticated Supabase client to read every reaction row. `20260822195800_harden_message_reactions.sql` replaces that permissive policy with room-membership-scoped reads and revokes direct mutation grants from `anon` and `authenticated`, so production writes pass through the authenticated, rate-limited NestJS API. Ownership/membership RLS mutation policies remain as defence in depth if direct grants are deliberately restored later.

The migration also adds a `NOT VALID` supported-emoji check. PostgreSQL enforces it for all new rows immediately without risking rollout on historical unsupported rows. Existing rows are retained; the API/UI only expose the supported set.

Reaction rows contain only message ID, user ID, emoji, and timestamp. They cascade with message/user deletion through the existing foreign keys. No new retention class or private content is introduced.

## Verification

Focused coverage includes:

- DTO rejection of unsupported emoji and non-boolean desired state;
- room-membership authorization before mutation;
- idempotent upsert and authoritative Centrifugo publication;
- bounded room-state loading and grouping;
- supported/unsupported reaction aggregation in Angular;
- add/remove desired-state emission and duplicate-interaction suppression.

The repository's normal database-reset, backend unit/build/lint, frontend unit/build/static-analysis, design-governance, and E2E checks remain the deployment gate.

## Rollout

1. Apply the Supabase migration before or alongside the backend deployment. Mixed versions are safe because the table and unique constraint already exist and no prior production client depended on direct reaction mutations.
2. Deploy the backend endpoints.
3. Deploy the Angular client. Old clients simply ignore the new Centrifugo event and continue chatting normally.
4. Watch API error/rate-limit logs and database reset checks after rollout.

## Rollback

Revert the application commits to remove the API and UI. Keeping the migration is safe and preferable because it only tightens access to an otherwise unused table. If direct authenticated Supabase mutation must be restored during an emergency rollback, explicitly restore the previous grants and policies in a new forward migration rather than editing deployed migration history.
