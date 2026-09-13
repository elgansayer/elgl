# Unified notifications inbox

The `/notifications` surface is the authenticated, chronological in-app inbox for social and system activity. It reuses the existing `notifications` table and listeners rather than creating a second delivery store.

## Product contract

- Supported activity types are follows, profile/moment likes, moment comments and replies, profile visits, chat/comment mentions, and system alerts.
- The UI defaults to **All** and exposes Likes, Comments, Followers, and System filters. Chat notifications remain visible in All.
- Entries are newest-first. The client requests at most 20 entries at a time and can request the next page with the oldest visible `created_at` value. The server caps every request at 50 records.
- Selecting an unread item persists its read state before decrementing the global unread counter. A failed write does not fabricate success.
- **Mark all read** is idempotent and updates only unread rows owned by the authenticated recipient.
- Empty inboxes are real empty states. Database/network failures are shown as retryable unavailable states and never replaced with fake people, messages, unread counts, or successful mutations.

## Authentication and privacy

All inbox endpoints remain behind `SupabaseAuthGuard`. The backend always derives `recipient_id` from the authenticated Supabase user and applies it to reads and writes. The client cannot select another recipient.

The browser treats API payloads as untrusted. Invalid records are discarded, text and array fields are bounded, and avatar URLs are accepted only for HTTP(S). Private notification bodies are rendered as text, never HTML. Avatar requests use `no-referrer`.

Operational failures are logged as stable event names such as `notifications_inbox.list_failed`; user IDs, notification text, tokens, provider errors, and other private payload data are not included.

## Failure and accessibility behavior

Initial loading exposes a status region. Initial load failures show an alert and explicit retry action. Pagination and read-mutation failures preserve the currently visible inbox and expose an error instead of clearing data. Concurrent Mark-all actions and Load-more actions are suppressed while one is in flight.

Each notification is a semantic button inside a list, so keyboard and touch activation share the same behavior. User-generated names/messages use `dir="auto"` for mixed-direction text. Unread state has a visual dot plus screen-reader text, so colour alone is not required. Actions have at least 44px touch height and wrap/reflow rather than requiring horizontal scrolling.

## Query and schema notes

The existing `notifications_recipient_created_idx (recipient_id, created_at DESC)` supports the inbox query shape, so no migration is required. Existing RLS/database ownership remains defense in depth; API ownership is also enforced explicitly. Notification retention/deletion behavior is unchanged by this feature.

## Rollout and rollback

The API change is additive and backward compatible: `type` still works, while optional `limit` and `before` parameters add bounded pagination. Older clients continue receiving an array response.

Roll out backend and frontend independently. To roll back the frontend, older clients can continue using the same endpoint. To roll back the backend pagination additions, remove use of `limit`/`before` in the client first. No data migration or destructive rollback is required.

## Verification

Automated coverage exercises filter/cursor composition, empty results, provider failures, recipient-scoped read mutations, controller ownership, client pagination, unread-counter updates, failed mutations, retryable pagination, navigation, and accessible activity presentation.
