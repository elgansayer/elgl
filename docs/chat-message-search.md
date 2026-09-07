# Chat message search

Issue: #1334

## Product contract

Chat search supports two scopes from the in-room search panel:

- **This chat** searches only the currently open room.
- **All chats** searches every room in which the authenticated learner is a current member.

Search begins after two non-whitespace characters and is debounced for 300 ms while typing. Results are newest first and capped by the API at 100 rows per request (the first-party client requests 50). The type chips filter the returned bounded result set locally, so changing a type does not create another database scan. Changing search scope re-runs the active query immediately.

Selecting a result from the current room emits the message to `ChatRoomComponent`, which uses the existing highlight/jump behavior. Selecting a result from All chats navigates to that result's room.

## Server-side query and `pg_trgm`

`GET /chat/search` is authenticated with `SupabaseAuthGuard` and throttled to 30 requests per minute. `SearchMessagesQueryDto` trims input, requires a 2-200 character term and bounds `limit` to 1-100.

`ChatService.searchAllMessages` first reads `chat_room_members` for the authenticated user. An optional `roomId` is accepted only when it is in that membership set. The message query is then constrained with `room_id IN (...)` before text matching.

Message text uses PostgreSQL `ILIKE '%term%'`. This query shape is backed by the existing `pg_trgm` GIN index:

```sql
CREATE INDEX IF NOT EXISTS chat_messages_text_content_trgm_idx
ON public.chat_messages USING GIN (text_content gin_trgm_ops);
```

`pg_trgm` is enabled by `001_initial_schema.sql`; the message index is created by `003_chat_and_favourites.sql`. No new migration is required for this issue and deployed migration history must not be rewritten.

## Privacy and authorization

Search never accepts a caller-supplied user identifier. The authenticated Supabase subject defines the room membership scope. Results also apply the existing bidirectional block list and remove messages deleted for everyone or deleted for the current learner.

The client renders result text with Angular interpolation, not raw HTML. Search terms, matched private message text, room IDs and result contents must not be added to analytics or application logs. Provider errors are represented as an unavailable state in the UI rather than logging private search context.

Search is a view over existing chat rows; it creates no new persisted personal data and therefore inherits chat retention, disappearing-message and account-deletion behavior.

## Failure and concurrency behavior

The UI distinguishes three states:

1. loading while a request is in flight;
2. a genuine empty result set;
3. a retryable search failure.

Each request receives a monotonically increasing local sequence number. A response from an older query or an old room/global scope is ignored after a newer request starts. This prevents slow responses from replacing newer results. Clearing the query below two characters also invalidates in-flight responses.

Retry repeats the current bounded query. No mutation or idempotency mechanism is necessary because search is read-only.

## Accessibility and responsive behavior

The search field has an accessible name and uses `type="search"`. Scope and type controls expose radio semantics with `aria-checked`; results use list semantics; loading, empty and error states are announced through status/alert regions. The search panel uses `w-full` on narrow layouts and constrains itself to `sm:w-80` on wider screens so it reflows at high zoom. Message text uses `dir="auto"` for mixed LTR/RTL content.

Important state is expressed in text in addition to visual treatment. All actions remain native/Spartan buttons and retain keyboard focus behavior.

## Verification

Automated coverage includes:

- the `pg_trgm` extension and `chat_messages_text_content_trgm_idx` contract;
- authenticated membership scoping, bounded query parameters, block/deletion privacy filtering and endpoint throttling;
- 300 ms client debounce and current-room scoping;
- immediate room/global scope changes;
- local message-type filtering;
- stale-response rejection;
- distinct failure/empty states and retry;
- short-query clearing; and
- global-result navigation.

GitHub Actions remains the authoritative clean-environment verification for frontend/backend unit suites, builds, lint/static analysis, migration replay, dependency review, translation checks and UI governance.

## Rollout and rollback

This change does not alter schema or the API response shape. Deploy the frontend normally; the server-side search endpoint and trigram index are backward compatible and already part of the application contract.

Rollback is application-only: revert the client search hardening and tests/docs if necessary. Do not drop `pg_trgm` or the GIN index during rollback because they are shared migration history and are safe for older clients.
