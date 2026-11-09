# Unified notifications inbox

The `/notifications` surface is the authenticated, chronological in-app inbox for social and system activity. It reuses the existing `notifications` table and listeners rather than creating a second delivery store.

## Product contract

- Supported activity types are follows, profile/moment likes, moment comments and replies, profile visits, chat/comment mentions, and system alerts.
- The UI defaults to **All** and exposes Likes, Comments, Followers, and System filters. Chat notifications remain visible in All.
- Entries are newest-first. The client requests at most 20 entries at a time and can request the next page with the oldest visible `created_at` value. The server caps every request at 50 records.
- Selecting an unread item persists its read state before decrementing the global unread counter. A failed write does not fabricate success.
- **Mark all read** is idempotent and updates only unread rows owned by the authenticated recipient.
- The open inbox loads on entry, filter change, retry and Show more. Unread badges refresh live over Centrifugo, but rows that arrive while the page is open appear on the next load.
- Empty inboxes are real empty states. Database/network failures are shown as retryable unavailable states and never replaced with fake people, messages, unread counts, or successful mutations.

## Where inbox rows come from

Every row is written by `NotificationsService.createNotification`, which also publishes the `unread.counts_changed` invalidation that refreshes badges over Centrifugo. Producers and listeners are connected only by event-name strings, so `notification-event-wiring.spec.ts` emits the exact names the producers use through a real `EventEmitter2`.

| Activity             | Producer                                                                             | Delivery                                                 |
| -------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| Follow, profile like | `UsersService.followUser`, `UsersService.likeProfile`                                | Direct `createNotification` call                         |
| Moment like          | `MomentsService.likeMoment` (only when a like is persisted on another user's moment) | `user.liked` to `LikeNotificationListener`               |
| Comment, reply       | `MomentsService.addComment`                                                          | `moment.comment` to `CommentNotificationListener`        |
| Comment mention      | `MomentsService.addComment`                                                          | `moment.mention` to `CommentMentionNotificationListener` |
| Chat mention         | Chat services                                                                        | `chat.mention` to `ChatMentionNotificationListener`      |
| Profile visit        | `ProfileVisitsService`                                                               | `profile.visit` to `ProfileViewNotificationListener`     |
| System alert         | Any domain that owns the decision                                                    | `system.alert` to `SystemNotificationListener`           |

Moment likes and comments honour the recipient's `moment_like` and `moment_comment` preferences: the `in_app` channel decides whether an inbox row exists and the `push` channel (plus quiet hours and Do Not Disturb) decides whether a push is sent. The listeners create the row without its built-in push so the preference-checked push is the only dispatch. If preferences cannot be read, the like listener fails closed. Repeating the same like (like, unlike, like) does not create a second row or push for the same actor and moment. The check compares stored rows, so a user who disables in-app delivery but keeps push has nothing to compare against and repeated like toggles can push again.

A reply is labelled as a reply only when it targets the moment author's own comment. Any other comment or reply on their moment is reported as a comment on their moment, so the text is never misleading. Replied-to users who are not the moment author are not notified by this change.

Local development: `npm run seed` in `backend/` inserts a few realistic inbox rows (follow, profile like, moment like, comment and a system alert) for the first seeded user through `backend/src/database/data/notifications.ts`. It skips users who already have notifications, and the production code paths never fall back to fabricated rows.

## System alerts

System alerts are platform messages with no human actor. Domain code emits `new SystemAlertEvent(recipientId, message, entityId?)` as `system.alert`. The message is plain text shown as-is, trimmed and capped at 500 characters; blank messages and missing recipients are rejected with the stable log event `system_alert_rejected` and never persisted.

`notifications.actor_id` is a required foreign key to `users`, and changing it would alter the generated database types baseline, so a system alert is stored against the recipient's own user id. The API replaces `actor_id` with the recipient id and drops the `actor` profile for every `system` row, and the inbox renders the localised system-alert title and a bell glyph instead of a person. Clients must not use `actor_id` for `system` rows.

No domain emits `system.alert` yet. Wiring a producer (for example a moderation or billing decision) is a product decision for the owning domain; each producer only needs to emit the event.

## Authentication and privacy

All inbox endpoints remain behind `SupabaseAuthGuard`. The backend always derives `recipient_id` from the authenticated Supabase user and applies it to reads and writes. The client cannot select another recipient.

The browser treats API payloads as untrusted. Invalid records are discarded, text and array fields are bounded, and avatar URLs are accepted only for HTTP(S). Private notification bodies are rendered as text, never HTML. Avatar requests use `no-referrer`.

Operational failures are logged as stable event names such as `notifications_inbox.list_failed`; user IDs, notification text, tokens, provider errors, and other private payload data are not included.

## Failure and accessibility behavior

Initial loading exposes a status region. Initial load failures show an alert and explicit retry action. Pagination and read-mutation failures preserve the currently visible inbox and expose an error instead of clearing data. Concurrent Mark-all actions and Load-more actions are suppressed while one is in flight.

Each notification is a semantic button inside a list, so keyboard and touch activation share the same behavior. User-generated names/messages use `dir="auto"` for mixed-direction text. Unread state has a visual dot plus screen-reader text, so colour alone is not required. Actions have at least 44px touch height and wrap/reflow rather than requiring horizontal scrolling.

## Query and schema notes

The existing `notifications_recipient_created_idx (recipient_id, created_at DESC)` supports the inbox query shape, so no migration is required. The duplicate-like lookup filters on `recipient_id`, `actor_id`, `type` and `entity_id` for one row and is bounded by the recipient index. Existing RLS/database ownership remains defence in depth; API ownership is also enforced explicitly. Notification retention/deletion behaviour is unchanged by this feature: rows are removed when either user is deleted (`ON DELETE CASCADE`) and by the privacy data-retention purge for the recipient.

## Rollout and rollback

The API change is additive and backward compatible: `type` still works, while optional `limit` and `before` parameters add bounded pagination. Older clients continue receiving an array response.

Moment-like and comment rows only start appearing once the backend is deployed, because earlier builds never produced them (nothing emitted `user.liked`, and the comment listener subscribed to `comment.moment` while the producer emitted `moment.comment`). Rolling the backend back stops new rows without touching existing ones. Roll out backend and frontend independently. To roll back the frontend, older clients can continue using the same endpoint. To roll back the backend pagination additions, remove use of `limit`/`before` in the client first. No data migration or destructive rollback is required.

## Verification

Backend specs cover the comment, like and system listeners (preference gating, push de-duplication, self-action guards, bounded system text), the real-emitter wiring contract, the moment-like emission rules, system-actor handling in `createNotification`, the duplicate lookup and system-row actor redaction. Automated coverage exercises filter/cursor composition, empty results, provider failures, recipient-scoped read mutations, controller ownership, client pagination, unread-counter updates, failed mutations, retryable pagination, navigation, accessible activity presentation, and actor-less system alert rows.
