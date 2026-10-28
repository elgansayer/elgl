# Chat room realtime lifecycle

This document records the production contract for the Angular `ChatRoomComponent`, the routed 1-on-1 and group conversation surface. It was established by issue #965 and completed by issue #1691, which added bounded history, membership-scoped realtime, privacy-aware read receipts, typing indicators and the group administration API that the component already called.

## Architecture

`ChatRoomComponent` (`/chat/:id`) is the canonical conversation surface. A room is treated as a group when the room record carries an `admin_id`. It reuses the authenticated `ChatService`, the shared `CentrifugeService` and `TypingService`; no second transport is introduced. The browser never talks to the database: every read and write goes through the NestJS API, and Centrifugo carries only server-published events.

| Concern                                           | Transport                                                           | Contract                                                                                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Room metadata and lock state                      | `GET /chat/rooms?include_locked=true`                               | Authenticated caller memberships only. The ordinary room list omits locked rooms; the routed room receives its own `is_locked` state.   |
| History                                           | `GET /chat/messages/:roomId?before=<ISO 8601>&limit=<1..100>`       | Newest page in ascending order, at most 100 rows. `before` is an exclusive cursor for older history.                                    |
| New, edited and deleted messages, receipt changes | Centrifugo `chat:<roomId>`                                          | `{ message }`, `{ status_update: { message_id, delivery_status } }`, `{ type: 'message_deleted', deleted_for: 'everyone', message_id }` |
| Typing                                            | Publish with `POST /chat/typing`, receive on `chat:<roomId>:typing` | See `docs/chat-typing-presence.md`.                                                                                                     |
| Read acknowledgement                              | `POST /chat/rooms/:roomId/read`                                     | One request for up to 100 message IDs.                                                                                                  |
| Who has read a message                            | `GET /chat/messages/:messageId/receipts`                            | Sender only.                                                                                                                            |
| Channel authorisation                             | `POST /chat/subscriptions/token`                                    | Membership-scoped Centrifugo subscription token. See `docs/centrifugo-server-config.md`.                                                |
| Participants and administration                   | `/chat/groups` routes                                               | See the group section below.                                                                                                            |

## History and pagination

`ChatService.getLatestMessages` is network-first, unlike the cache-first `getMessages` used for list previews, because an open room must show the newest server state. It warms the room cache on success. When the network is down or the server returns a 5xx for the first page it falls back to the cached snapshot so the room stays readable; an authorisation failure (401 or 403, for example after being removed from a group) never falls back to old local content. Older pages are never cached because they are a partial view.

The room shows one of these states, each with a translated, screen-reader-visible message:

- loading while the first page is requested;
- empty when the conversation has no messages;
- unavailable with a Retry action when history cannot be loaded (network or server fault);
- forbidden with a Retry action when the API refuses access;
- "Load earlier messages" only when a full page (100) was returned, disabled while loading, and, if it fails, an inline alert with Retry that keeps the messages already loaded.

The backend never invents messages. An empty room returns an empty array and a database failure returns an error, replacing the previous synthetic conversation that was returned for empty rooms.

Room discovery is also membership-scoped and never returns fixture rooms. The ordinary inbox continues to omit locked rooms. `ChatRoomComponent` explicitly requests lock metadata, does not cache that expanded response, and fails closed behind a translated unavailable state if the API cannot verify the request or the requested room is absent from the caller's membership-scoped result. Retry repeats the metadata and lock check before history, realtime subscriptions or send controls are enabled.

## Live message stream

The room treats Centrifugo payloads as untrusted input. `chat-room-realtime.ts` validates the minimum message identity fields and only accepts the known `sent`, `delivered` and `read` receipt states.

1. A persisted message is returned by `POST /chat/messages` with `delivery_status = sent`. The API verifies that the sender is a member of the room before anything is written or published.
2. A `message` event for the current room is merged by message ID. This prevents the same message being rendered twice when the sender receives both the HTTP response and the realtime echo, and lets authoritative edit payloads replace stale local fields.
3. Receipt state is monotonic (`sent` < `delivered` < `read`). A late or stale event, or an older snapshot of a message, can never take a receipt backwards.
4. Authoritative `message_deleted` events with `deleted_for = everyone` remove the message from the open room.
5. Malformed, wrong-room, unknown-status and unrelated payloads are ignored.

### Catching up after a gap

Centrifugo delivers only what is published while the client is subscribed, so the API is the source of truth for anything missed. Whenever the transport reports a live connection while the room is subscribed (a reconnect, a connection that only became active after the history request, or opening the room on an already-open connection) the component fetches the newest page and reconciles it with `reconcileLatestWindow`:

- messages in the window replace their local copy, with receipts kept monotonic;
- persisted messages inside the window range that the server no longer returns were deleted or hidden and are dropped;
- older history the reader already loaded is kept, unless a full window shares nothing with what is shown, which means an unseen gap sits between them and the list starts over from the window;
- messages newer than the window were published after the server built it, so a live event that raced the request is kept;
- ephemeral system events exist only in realtime and are always kept.

A 401 or 403 discovered while catching up switches the room to the forbidden state.

### Reading position

The message list is a labelled `role="log"` region that is deliberately **not** a live region (`aria-live="off"`), so opening a long conversation, retrying, or loading earlier history is never read out message by message. Instead a separate visually hidden polite status region (`data-testid="incoming-announcement"`) announces genuinely new incoming messages:

- one message from someone else: "<name>: <text>", with the text cut at 200 characters;
- several arriving together: "N new messages";
- a message without text, such as a voice note: "<name> sent a message.";
- nothing for the reader's own messages, system events, history, earlier pages or receipt updates.

- The first page of a room, a retry and a search result start at the newest message.
- While the reader is within 80 CSS pixels of the newest message the list follows the conversation. The reader's own messages always scroll into view.
- Otherwise the position is left alone and a "N new messages" button (`data-testid="jump-to-latest"`) appears. It counts messages from other people, ignores system events, and jumps to the newest message when used or when the reader scrolls back down themselves.
- Older history inserted above the viewport preserves the reading offset in every browser, and receipt or edit updates never move the list.
- A typing indicator that appears while the reader is following the conversation is scrolled into view.

## Read receipts

`chat_messages.delivery_status` is the sender-facing aggregate: `sent`, then `delivered`, then `read`. It only ever moves forward.

Mixed-version rows can carry the legacy `is_read = true` while `delivery_status` still has its newer `sent` default. The client treats the legacy boolean as `read`, normalises merged snapshots to `read`, and rejects malformed realtime receipt values, so migration order or a stale publication cannot visually regress the receipt.

Read receipts respect the existing per-user `chat_preferences.readReceipts` setting, which is off by default:

- a reader who has not turned it on never discloses a read, so nothing is stored for them;
- `message_receipts` holds one row per reader per message, only for readers who opted in;
- the aggregate becomes `read` only when every other room member has read the message with receipts enabled, so a room with someone who keeps receipts off stays at `delivered`;
- only the sender can ask who has read a message, and only members appear in the answer.

### Acknowledging reads

The client sends one `POST /chat/rooms/:roomId/read` with `{ message_ids: [...] }` (1 to 100 IDs). Unknown IDs, IDs from other rooms, the caller's own messages and non-UUID values are ignored rather than rejected, and the response is `{ success, marked }`. The request is idempotent: receipts are inserted with `ON CONFLICT DO NOTHING` and promotion to `read` is a conditional update, so a retry, a lost response or two readers acting at once can never duplicate a publication or move a status backwards.

The component acknowledges a message only when the reader can actually see it:

- the page is visible (`document.visibilityState` is not `hidden`), and
- the list is at, or following, the newest message.

Anything that arrives while the tab is hidden or the reader is scrolled away is acknowledged when they return (visibility change, scrolling to the bottom, or the jump button). Acknowledged IDs are remembered for the room session so scrolling and reconnects never resend them, and a failed request is retried on the next trigger. System events are never acknowledged.

The legacy `PATCH /chat/messages/:messageId/status` remains for older clients. It now goes through the same receipt service, so `read` records the opt-in receipt and aggregates instead of marking a message read outright.

### Presentation

`ReadReceiptComponent` renders on the reader's own messages only. Sent is one tick, delivered two ticks and read two heavier ticks, so the state never depends on colour. Every receipt has a translated accessible name and the newest own message also shows the state as text. In a group the receipt is a button that opens a popover listing who has read the message and when. The list is fetched fresh each time the popover opens, has loading and retry states, and states that only people who turned on read receipts are listed.

## Typing indicators

Typing is ephemeral and never persisted. Clients publish through the API, which checks room membership and publishes `{ userId, typing, timestamp }` to `chat:<roomId>:typing`. The room resolves each typist's name and avatar from the participant roster it already trusts and falls back to a translated "Someone". See `docs/chat-typing-presence.md`.

## Groups

Participant and administration routes live under `/chat/groups` and are protected by `SupabaseAuthGuard`. The caller comes from the session, never the request body.

| Route                                           | Behaviour                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /chat/groups`                             | Creates a group. Name is trimmed and at most 100 characters; 1 to 50 unique member UUIDs. A failed member insert removes the room so no orphan remains. |
| `GET /chat/groups/:roomId/members`              | Members only. Returns display name, avatar, native and target languages and VIP status, honouring `privacy_hide_vip_status`.                            |
| `PATCH /chat/groups/:roomId/rename`             | Admin only.                                                                                                                                             |
| `POST /chat/groups/:roomId/members`             | Admin only. Up to 49 UUIDs; duplicates collapse and members already present are skipped so retries are safe. A group is capped at 51 members.           |
| `DELETE /chat/groups/:roomId/members/:memberId` | Admin only. The admin cannot be removed; removing someone who is already gone succeeds without a second system message.                                 |

## Authorisation

Room membership is enforced in the API because the service-role Supabase client bypasses row level security. Sending, loading history, publishing typing, listing participants and minting a subscription token share one check: a missing room is a 404, a non-member is a 403, and a database error while verifying is a 503 so an outage is never mistaken for a refusal. Read acknowledgements and receipt lookups use the same room check. An unknown room or message is a 404, a non-member is a 403, and an access or receipt-detail query failure is a 503 rather than a fabricated empty result.

`GET /chat/rooms` begins from the caller's `chat_room_members` rows and constrains the room query to those IDs, because the service-role client would otherwise see every room. A membership, room or blocked-member query failure returns 503 instead of an incomplete list that could expose a protected or blocked conversation.

Centrifugo's `chat` namespace rejects client subscriptions without a token and rejects client publications. The API mints a five-minute subscription token per room and stream after verifying membership, and `centrifuge-js` refreshes it through `getToken`. A 401, 403 or 404 becomes an `UnauthorizedError`, which stops that subscription instead of retrying in a loop.

## Failure and degraded behaviour

| Failure                                          | Behaviour                                                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room metadata or lock state cannot be loaded     | Conversation and send controls stay hidden; Retry repeats the lock check. No room is fabricated or cached.                                            |
| The inbox cannot load the room list              | An alert with Retry replaces the list. A failure is never shown as "no conversations", because the API returns an error rather than invented rooms.   |
| History cannot be loaded                         | Unavailable or forbidden state with Retry; nothing is fabricated.                                                                                     |
| Centrifugo unavailable or rate limited           | An alert explains that live updates are unavailable. Persisted history and sending keep working, and the room catches up when the connection returns. |
| Read acknowledgement fails                       | Non-blocking. Retried on the next trigger.                                                                                                            |
| Typing fails                                     | Ignored. Never gates message sending.                                                                                                                 |
| Send fails                                       | The text stays in the composer and is saved as a draft, with a translated error.                                                                      |
| Suggested-reply provider fails or returns empty  | The API returns 503. It never substitutes generic replies that could be mistaken for personalised output.                                             |
| Receipt publish fails on the server              | The receipt is already persisted; the client reconciles on reconnect or reload.                                                                       |
| Slow response for a room the reader already left | Discarded, so it cannot overwrite the current room.                                                                                                   |

## Security and privacy

Sender and reader identity always come from the authenticated session. A reader's identity is disclosed only to the author of the message they read, and only if they opted in. Typing payload names are sanitised (control characters and bidirectional overrides removed, length capped) and typing payload avatars are never rendered. The number of tracked typists is bounded. Realtime payload validation prevents arbitrary status strings or cross-room messages from mutating the open room.

## Observability

- `ReadReceiptsService` logs a warning `Receipt publish failed room=<id> message=<id> status=<status>` when a status event cannot be published. Only identifiers are logged.
- `CentrifugoService` logs publish failures with the channel and a sanitised error, never credentials or message content. Centrifugo reports command-level failures (an unknown channel or a permission error) with HTTP 200 and an `error` object in the body, so `publish` inspects the body as well as the status. Both cases return `false` and log a warning with the channel, the HTTP status and the numeric error code only; whatever text the server echoes back is not logged.
- `ChatService` logs a warning `Delivery receipt failed room=<id> message=<id>: <error>` if the delivered tick cannot be recorded after a message was stored and published. The message itself is unaffected.
- `ChatService` logs a sanitised warning when suggested-reply generation fails. It does not log the conversation or generated content.
- A 503 `Room access could not be verified` distinguishes an outage from a 403 or 404.
- Centrifugo's Prometheus endpoint remains the source for connection and subscription volume.
- No message body, token or receipt payload is written to logs.

## Data and retention

`message_receipts` (introduced in `013_chat_message_enhancements.sql`) stores one row per opted-in reader per message. Rows are deleted with their message and with their reader (`ON DELETE CASCADE`). Migration `20260926120000_harden_message_receipts.sql` enables row level security with no policy and revokes access from `anon` and `authenticated`, so only the API's service role can read or write receipts, and adds a `read_at` requirement for `read` rows as a `NOT VALID` constraint that applies to new writes without rewriting legacy data. Queries use the existing `message_id` and `user_id` indexes and every receipts query is bounded.

The migration adds no table, column, index or `COMMENT`, so the generated Supabase types baseline (`supabase/database-types.snapshot.json`) that CI compares after a clean replay is unchanged by it. `backend/src/database/migrations/20260926120000_harden_message_receipts.spec.ts` asserts that.

### Schema the conversation API assumes

The API reads columns that the backend's typed `Database` contract (`backend/src/supabase/supabase.service.ts`) declares but that the migration corpus under `supabase/migrations` does not provide on a clean replay:

- `chat_rooms`: `008_local_dev_seed_tables.sql` defines a text-id table with `title`, `subtitle`, `avatar` and `is_online`, which the clean-replay shim drops so that `014_chat_rooms_table.sql` can create the UUID-id table, and that one has `name`, `avatar_url` and `created_by` instead. Neither shape has `admin_id`, `wallpaper_url` or `labels`, so a replayed database has no group administrator column.
- `users.chat_preferences` and `users.privacy_hide_vip_status` are not created by any migration.
- `chat_room_members.is_locked` is defined only in the legacy `backend/src/database/migrations/011_add_chat_locks.sql`.

This gap pre-dates issue #1691, because the room list has always selected these columns. It matters more now that the API reports a failed query as an error instead of substituting synthetic rooms: on a database built only from the current corpus the room list answers 503, and a missing `chat_preferences` column leaves read receipts at their privacy-safe default of off.

The follow-up is a forward migration that adds the missing columns with `ADD COLUMN IF NOT EXISTS`, together with a refreshed `supabase/database-types.snapshot.json`. The snapshot has to be regenerated against a clean replay with `supabase gen types typescript --local`, which needs the Supabase CLI and Docker, so it was not attempted from this change.

## Accessibility and UX

Receipt meaning is never carried by colour alone (tick count, weight and text). The typing sentence is both the visible text and the accessible name of a polite status region. The message list is a labelled log with a separate polite announcer for new incoming messages, the composer has an accessible name, and the "new messages" and read-receipt controls have visible focus and keyboard operation through the Spartan button and popover. A reply's quoted preview is a button named after what it points at ("Go to the replied message from <name>: <text>", the text cut at 200 characters), so the visible sender and text are part of its accessible name. Its fallbacks when the parent is not loaded are the preview sent with the message and then localised unavailable labels. Decorative glyphs (the room icon and the pencil on a correction request) are hidden from assistive technology. Animation stops under `prefers-reduced-motion`. Spacing uses logical properties so the room mirrors in RTL, and the room reflows at 390px and high zoom. The visual contract is recorded in `frontend/design-preview/screens/chat.html` (`screen.chat`).

## Verification

Backend (Vitest): the chat controller, groups controller, chat service, read receipts service, Centrifugo service, DTOs and the migration contract, including membership enforcement, receipt privacy, idempotency and bounded queries.

Backend end to end (`backend/test/chat-room.e2e-spec.ts`, run with `npm run test:e2e`): boots the real `AppModule` with the same global `ValidationPipe` options as `main.ts` and replaces only the database, Centrifugo and authentication. It proves the routes are registered, that the strict pipe rejects malformed bodies and queries before any chat table is touched, that subscription tokens are bound to the caller and one channel, that non-members and outages get 403, 404 or 503 respectively, that history pages oldest first with the cursor applied, that sending publishes the message and then the delivered tick, and that the full opted-in receipt flow ends in a `read` publication while an opted-out reader discloses nothing. Unit tests build services by hand, so this is also what guards dependency injection: `ChatService` receives `ReadReceiptsService` through an explicit `@Inject`, because a union-typed constructor parameter erases to `Object` in the emitted decorator metadata and Nest would otherwise silently inject `undefined`, answering every receipt route with 503. `chat.service.spec.ts` resolves it through the injector for the same reason.

Frontend (Vitest):

- `chat-room-realtime.spec.ts`: event validation, merging, monotonic receipts, reconciliation and pagination helpers;
- `chat-room.stream.spec.ts`: history states, pagination, live updates, catch-up, receipts, typing, reading position, incoming-message announcements and room switching;
- `read-receipt.component.spec.ts`, `typing-indicator.component.spec.ts`, `typing.service.spec.ts`, `centrifuge.service.spec.ts` and `chat.service.spec.ts`;
- `chat-list.component.spec.ts`: the inbox error state and its recovery.

Cypress `chat-flow.cy.ts` covers the routed room end to end with intercepted API responses. `scripts/centrifugo-config-contract.test.mjs` covers the namespace authorisation settings.

## Rollout and rollback

Deploy in this order so mixed versions keep working:

1. Apply the migration. It is expand-only and safe to retry; the API uses the service role, which is unaffected by row level security.
2. Deploy the backend. It adds the new endpoints and keeps the legacy status route.
3. Deploy the frontend, which uses subscription tokens and the new endpoints.
4. Apply the Centrifugo `chat` namespace configuration that requires subscription tokens and rejects client publication. Applying it before step 3 would stop older clients subscribing.

Rollback is a normal revert of the application changes. Persisted messages and receipts need no cleanup. Keep the row level security hardening in place. If the `read_at` constraint itself must be removed, drop only `message_receipts_read_at_check`. Reverting the Centrifugo configuration restores the previous namespace behaviour.
