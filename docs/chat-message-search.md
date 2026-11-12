# Chat message search

Issues: #1803, #1837

## Product contract

Chat search supports two scopes from the in-room search panel:

- **This chat** searches only the currently open room.
- **All chats** searches every visible room in which the authenticated learner is a current member.
  Chats hidden by that learner remain excluded until the existing app-unlock flow clears the
  per-member lock.

Search begins after two non-whitespace characters and is debounced for 300 ms while typing. Visible results are newest first and capped at 100 per request (the first-party client requests 50). The type chips filter the returned bounded result set locally, so changing a type does not create another database scan. Changing search scope re-runs the active query immediately.

Selecting a result from the current room emits the message to `ChatRoomComponent`, which renders the target when it is outside the initial history window before using the existing highlight/jump behaviour. Selecting a result from All chats navigates to that result's room.

## Server-side query and `pg_trgm`

`POST /chat/search` is registered by `ChatModule`, authenticated with `SupabaseAuthGuard` and throttled to 30 requests per minute. Its JSON body is validated by `SearchMessagesQueryDto`, which trims input, requires a 2-200 character term and bounds `limit` to 1-100. The private search term stays out of the URL and the response is marked `Cache-Control: no-store`.

`ChatService.searchAllMessages` first reads `chat_room_members` for the authenticated user and
removes memberships whose private `is_locked` preference is true. An optional `roomId` is accepted
only when it remains in that visible membership set, so supplying a hidden room identifier directly
cannot bypass the app-unlock flow. The message query is then constrained with `room_id IN (...)`
before text matching. If every joined chat is hidden, search returns an empty result without querying
messages.

Unencrypted message text uses PostgreSQL `ILIKE '%term%'`, with `%`, `_`, `*` and `\` escaped so caller input is always literal search text rather than a database wildcard pattern. Plaintext matches and encrypted candidates use independent bounded queries, so encrypted non-matches cannot consume the plaintext match limit. The encrypted candidate window is four times the requested visible limit, capped at 200. Candidates are returned with their E2EE envelope, decrypted in memory by the authorised client, filtered there with literal substring matching, merged newest first and capped to the requested visible limit. The plaintext query shape is backed by the existing `pg_trgm` GIN index:

```sql
CREATE INDEX IF NOT EXISTS chat_messages_text_content_trgm_idx
ON public.chat_messages USING GIN (text_content gin_trgm_ops);
```

`pg_trgm` is enabled by `001_initial_schema.sql`; the message index is created by `003_chat_and_favourites.sql`. No new migration is required for this issue and deployed migration history must not be rewritten.

## Privacy and authorization

Search never accepts a caller-supplied user identifier. The authenticated Supabase subject defines
the room membership scope. The authenticated learner's per-member hidden-chat preferences further
restrict that scope. The database query applies the existing bidirectional block list and both
deletion predicates before ordering and limiting, so hidden rows cannot displace older visible
matches.

The response is an allowlisted search projection containing only the identifiers, text or encrypted envelope, encryption marker, type, sender label, read state, timestamp and expiry needed by the search UI and disappearing-message interceptor. It never returns media URLs, view-once state or the internal list of learners who hid a message.

The client renders result text with Angular interpolation, not raw HTML. Search terms, matched private message text, room IDs and result contents must not be added to analytics or application logs. Provider errors are represented as an unavailable state in the UI rather than logging private search context.

Search is a view over existing chat rows; it creates no new persisted personal data and therefore inherits chat retention, disappearing-message and account-deletion behavior.

## Failure and concurrency behavior

The UI distinguishes three states:

1. loading while a request is in flight;
2. a genuine empty result set;
3. a retryable search failure.

Membership lookup or message query provider failures return a sanitised `503 Service Unavailable` response. They are logged with a stable failure-stage key and without the search term, room identifier, message text or provider error details. A learner with no joined rooms, or a room-scoped search outside their memberships, receives a successful empty result instead.

Each request receives a monotonically increasing local sequence number. A response from an older query or an old room/global scope is ignored after a newer request starts. This prevents slow responses from replacing newer results. Clearing the query below two characters also invalidates in-flight responses.

Retry repeats the current bounded query. No mutation or idempotency mechanism is necessary because search is read-only.

## Accessibility and responsive behavior

The search field has a persistent translated label and uses `type="search"`. Scope and type controls use named Spartan radio groups backed by native radio inputs, which provide standard Tab and arrow-key operation. Results use list semantics; loading, empty and error states are announced through status/alert regions. The search panel uses `w-full` on narrow layouts and constrains itself to `sm:w-80` on wider screens so it reflows at high zoom. Message text uses `dir="auto"` for mixed LTR/RTL content.

Important state is expressed in text in addition to visual treatment. All actions remain native/Spartan buttons and retain keyboard focus behavior.

## Verification

Automated coverage includes:

- the `pg_trgm` extension and `chat_messages_text_content_trgm_idx` contract;
- authenticated membership scoping, bounded query parameters, block/deletion privacy filtering and endpoint throttling;
- exclusion of per-member hidden chats from global and explicit room searches;
- independent plaintext and encrypted limits so encrypted non-matches cannot truncate plaintext matches;
- Nest module registration and sanitised provider-failure propagation;
- 300 ms client debounce and current-room scoping;
- immediate room/global scope changes;
- local message-type filtering;
- stale-response rejection;
- distinct failure/empty states and retry;
- short-query clearing; and
- global-result navigation;
- rendering and scrolling to a result outside the loaded room-history window; and
- named native radio-group semantics for search scope and message type.

GitHub Actions remains the authoritative clean-environment verification for frontend/backend unit suites, builds, lint/static analysis, migration replay, dependency review, translation checks and UI governance.

## Rollout and rollback

This change does not alter schema. The previously unregistered search controller is activated as an authenticated POST endpoint, and its allowlisted response contains the fields required by the first-party search UI. Deploy the backend and frontend together; the existing trigram index remains compatible with older application versions.

Rollback is application-only: revert the client search hardening and tests/docs if necessary. Do not drop `pg_trgm` or the GIN index during rollback because they are shared migration history and are safe for older clients.
