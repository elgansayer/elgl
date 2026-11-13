# Rich link previews

## Scope

Text chat messages may include a single OpenGraph link preview supplied by the NestJS chat API. The backend remains authoritative for fetching external metadata through `LinkPreviewService`; Angular never fetches arbitrary third-party pages directly. `ChatMessageComponent` renders the optional payload through the shared `LinkPreviewCardComponent`.

The repository now has the complete #1426 production path: the authenticated NestJS OpenGraph scraper, Redis caching, chat payload integration, and the Angular rich-preview card. #1678 closes the last gap in that path: the preview is stored with its message, so the card survives a reload instead of existing only on the live publication. The frontend and backend contracts remain compatible: a preview contains `url`, `title`, `description`, `image`, and `siteName`, and messages continue to work when `link_preview` is absent.

## Persistence and history

The preview is resolved once, by the sender's request, and stored in the nullable `chat_messages.link_preview` JSONB column. `GET /api/chat/messages/:roomId` returns it with the rest of the row, and the chat room renders it through the same `msg.link_preview` binding it uses for realtime messages. Without storage the card existed only on the live publication, so reloading a room, an offline recipient, a reconnecting client and a member who joined later all saw the bare URL.

- **Send (direct and group):** the message row is inserted first, as before, so a slow origin never delays or loses the message. The resolved preview is then written to that row before the realtime publication is sent, so a client that reloads on the event already finds it.
- **Edit:** the preview is resolved before the write and stored in the same statement as the new text. Concurrent edits therefore cannot interleave into a card that describes different text. A removed or unresolvable link clears the previous card in that statement, so a stale card never outlives the text it described. The column is only referenced when there is a card to store or clear.
- **Forward:** the forwarded copy is inserted with the preview, resolved once for every target room.
- **Viewing history never scrapes.** Reads return what was stored. Opening a room does not make the server contact the link's origin, which would amplify outbound requests and reveal when a recipient read the chat.
- **Encrypted messages never carry a card.** The scraper is not invoked for them, and the `chat_messages_link_preview_shape` constraint rejects a non-null preview on an encrypted row, so the link of an encrypted conversation cannot reach a plaintext column.
- **Bounds.** The constraint requires a JSON object with a string `url` and at most 16 KiB, matching the scraper's own cache-entry bound. The column is never filtered on, so it has no index.
- **Retention and deletion.** The card shares the lifecycle of its message row. Delete for everyone, disappearing-message expiry and account erasure delete the row and therefore the card. Data exports include it with the sender's message row.
- **Staleness.** The stored card is a snapshot taken at send time and is not refreshed when the origin page changes. The browser still treats it as untrusted and fails closed on unsafe URLs.

Storing the preview is best effort, like the scrape itself. If the write fails, the card is still delivered on the live publication and `chat.link_preview_persist_failed message=<id>` is logged at `warn`. Only the opaque message id is logged, never the URL or the preview.

## Backend scraping contract

- Only absolute `http:` and `https:` page URLs are accepted. Embedded credentials, non-default ports, localhost, literal private/link-local addresses, and overlong URLs are rejected before network access.
- Outbound HTTP uses guarded DNS lookup. If DNS returns multiple addresses, every returned address must be publicly routable; a single private/link-local result rejects the lookup. This avoids treating only the first address as authoritative.
- Scrapes use a 5 second connect, response-header and idle timeout plus a hard 8 second deadline for the whole scrape. The deadline matters because axios's timeout only acts as an idle timer once headers arrive, so an origin that sends headers and then drips the body would otherwise hold the request, and the chat send awaiting it, open indefinitely. Expiry cancels the request and destroys its socket. Scrapes also follow at most three redirects, accept at most 5 MB, and require an HTML response.
- Script, style, and noscript nodes are removed before metadata extraction. OpenGraph fields fall back to the first document `<title>` (so inline SVG icon titles are never appended) and the description meta tag where appropriate.
- Metadata is plain-text sanitised and bounded server-side before it can enter Redis or a chat payload: title 300 characters, description 1,000 characters, and site name 200 characters.
- Preview image URLs must be HTTP(S), credential-free, use a default port, fit within the URL bound, and not use a literal private/link-local host. Unsafe image metadata is dropped without failing the message preview.
- Redis keys contain only a SHA-256 digest of the normalized page URL. Cached preview payloads are treated as untrusted: entries over 16 KiB, malformed JSON, mismatched page URLs, unsafe image URLs, or payloads without usable preview content are ignored and refreshed from origin.
- Cached metadata is re-sanitised and re-bounded on read. This keeps mixed-version or corrupted cache entries from bypassing the current output contract.
- Cache failures are best-effort. A Redis outage does not turn link enrichment into a chat-delivery failure.

## Persistence and history

Before this was added a preview existed only in the realtime publication, so reloading a conversation, or opening it after being offline, showed plain text. The preview is now stored on the message row.

- **Column.** `chat_messages.link_preview` is nullable `JSONB` holding the same `{ url, title, description, image, siteName }` object that is published. A `CHECK` constraint (`chat_messages_link_preview_check`) requires a JSON object of at most 16 KiB, which equals the 16 KiB bound already applied to Redis cache entries and sits far above the 300/1,000/200 character field bounds plus two URLs of at most 2,048 characters.
- **Writers.** Only `ChatService` writes it, and only with a preview it has just resolved through `LinkPreviewService`: direct send, group send, edit and forward. Client input is never stored: insert payloads are built field by field, the global validation pipe rejects unknown properties, and the restrictive `chat_messages_link_preview_backend_only` RLS policy requires authenticated direct inserts to leave the column null. The backend service role is outside that policy and remains the sole non-null writer.
- **Ordering.** When a preview resolves, it is stored before the message is published, so anything a client sees live is also in the history it loads later. Sends and forwards use a separate idempotent preview update after inserting the message. Edits atomically update the text and preview in one statement.
- **Best effort.** A failed preview write never fails a send or forward. It is logged as `chat.link_preview_persist_failed message=<id> code=<database error code>` (no URL, title or database message) and the live event still carries the card; only history lacks it. An unmigrated database reports code `42703`.
- **Edits.** The stored preview follows the text. An edit that removes the link, or whose new link cannot be previewed, atomically stores `null` with the new text and publishes that explicit `null`. The update predicates on the text fetched for authorisation, so the first overlapping edit to commit wins. A slower stale edit receives HTTP 409 and is not persisted or published.
- **Correction fixes.** Applying another member's correction (`fixMessage`) rewrites the text without scraping anything. A stored preview that still describes the first link is kept; one that no longer does is cleared in the database and published as `null`, so clients drop the card instead of keeping a stale one. A message without a stored preview is published exactly as before.
- **Reads.** `getMessages`, `searchAllMessages` and `exportChatHistory` pass every row that has a stored preview through `LinkPreviewService.restoreStoredPreview` before it leaves the API. The stored value is treated as untrusted, exactly like a cache entry: text fields are sanitised and bounded again, an unsafe image is dropped, and the preview must describe the normalised first `http(s)` link of the message's current text and pass the scraper's URL policy. A malformed, stale or orphaned preview becomes `null`. This makes a lost clearing write, two concurrent edits, an older instance that edits the text without knowing about the column during a rollout, or a forged backup import unable to put a wrong card on screen. Rows without a stored preview are returned untouched, and the read path makes no network, Redis or metrics call, so history latency does not depend on how many links a room contains.
- **Not backfilled.** Messages sent before the migration have no stored preview and are not scraped retroactively. Scraping an unbounded backlog of old URLs on deploy would be an abuse risk, and the pages may have changed since the message was sent.

### Retention and deletion

The preview is part of the message row and has no lifecycle of its own.

| Event                               | Effect on the stored preview                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Delete for everyone                 | The row is hard-deleted, so the preview is deleted with it.                                                                |
| Disappearing-message expiry         | The purge function hard-deletes the row and the favourites snapshots of it.                                                |
| Account deletion and data retention | Messages are hard-deleted by sender.                                                                                       |
| Delete for me                       | The row is hidden for that user only; the preview stays for the other participants.                                        |
| Edit                                | Replaced or cleared, see above.                                                                                            |
| Personal data export                | The user's own messages are exported with their stored preview, which is public third-party metadata for a link they sent. |
| Favourite                           | The snapshot copies the message row, so it carries the preview and follows the snapshot's own lifetime.                    |

The Redis cache keeps its separate one hour TTL and is not a retention store.

## Rendering contract

- Only absolute `http:` and `https:` destinations are rendered.
- URLs containing embedded usernames or passwords are rejected at the browser boundary.
- Preview images follow the same protocol and credential rules as destinations.
- Title, description, and site-name metadata are rendered only as escaped plain text.
- The browser independently caps title at 300 characters, description at 1,000 characters, and site name at 200 characters. These bounds mirror the backend scraper and protect cached or realtime payloads produced by mixed-version deployments.
- If the site name is missing, the destination hostname is shown instead.
- The displayed address omits query strings and fragments. The actual link target remains unchanged, so signed or stateful links still work without duplicating sensitive query data in the preview chrome.
- External metadata uses `dir="auto"`; the URL display remains LTR. Long metadata wraps and the card can shrink at high zoom without forcing horizontal page overflow.
- A failed preview image is removed while the title, description, and destination remain usable.

## Privacy and security

The card treats backend, cache, and Centrifugo payloads as untrusted input. Angular interpolation provides the final HTML escaping boundary, while the component also strips markup and rejects unsupported URL schemes before binding navigation or image URLs.

Both the outbound anchor and preview image use `referrerpolicy="no-referrer"`. Opening a preview therefore does not send the ELGL page URL as the HTTP referrer, and fetching a third-party OpenGraph image does not disclose the current chat route through the referrer header. The anchor also uses `noopener noreferrer` to prevent the opened page from controlling the ELGL window.

The backend does not log raw scraped URLs or provider error text. Diagnostics use the hostname plus a short SHA-256 URL fingerprint, which is sufficient to correlate failures without copying query strings, paths, credentials, or message content into logs.

No additional analytics, browser storage, or user profiling is introduced by link previews. The only data they persist is the bounded preview stored on its own message row (see Persistence and history), which is removed with the message and never stored for an encrypted message. The only third-party requests are the bounded backend page scrape and, when present, the browser image request required to render the preview.

## Observability

Every request is counted by outcome (`cache_hit`, `fetched`, `empty`, `rejected`, `failed`), every refusal or failure by a closed reason (`invalid_url`, `blocked_target`, `timeout`, `not_html`, `too_large`, `upstream_status`, `network`, `unknown`), and every origin scrape is timed. These are exported as `hellotalk_link_preview_requests_total`, `hellotalk_link_preview_failures_total` and `hellotalk_link_preview_fetch_duration_seconds`. Labels are closed enums, so no URL, hostname or provider message can reach the metrics endpoint. The reason catalogue, example PromQL and log format live in `backend/src/link-preview/README.md`.

Failure logs carry the hostname, a short URL fingerprint and the reason. Origin-caused reasons are logged at `warn`; only `unknown` is logged at `error`, so routine dead links do not hide real faults.

A failure to store a resolved preview is logged as `chat.link_preview_persist_failed message=<id>` at `warn`. The opaque message id is enough to find the affected message when someone reports a card that vanished after a reload; the line never contains the URL or preview. A sustained rate of this warning points at the `link_preview` column or its constraint, for example a backend deployed before the migration.

## Failure behaviour

Link-preview enrichment is optional. If the scraper cannot resolve metadata, the chat message is still delivered and rendered without a preview. Unsupported resources, malformed destinations, blocked network targets, timeouts (including the hard 8 second deadline), oversized pages, and other scrape failures return a stable bad-request response at the preview API boundary rather than exposing provider details.

If the preview cannot be stored, the message is delivered with its live preview and only history is missing the card (see [Persistence and history](#persistence-and-history)). If Redis is unavailable, the scraper fetches the origin directly and returns the fresh result without caching it. If a malformed, oversized, stale, or URL-mismatched cache entry is encountered, it is ignored and refreshed rather than trusted.

If a malformed or unsafe preview reaches the client through an older cache, a stored message or a realtime publication, the preview card fails closed while leaving the original message text visible. Image failures degrade to a text-only preview. No automatic retry loop is used in the browser, avoiding repeated requests to a failing external origin.

If the resolved preview cannot be stored, the message is already saved and published, so the card is still delivered live and only its persistence is lost: after a reload that message shows its text without a card. Messages sent before the `link_preview` column existed have no stored card and are not backfilled, because rebuilding them would require scraping third-party origins for old links.

## Verification

Focused backend tests cover:

- malformed, overlong, private-network, credential-bearing, custom-port, and non-HTTP(S) page URLs;
- hashed cache keys and Redis outage degradation;
- cache URL binding, cache-size bounds, metadata re-sanitisation, and unsafe cached image rejection;
- OpenGraph extraction, Twitter Card tags, and title/description fallback;
- request query DTO validation and response typing;
- 300/1,000/200-character output bounds before caching;
- strict plain-text sanitisation and unsafe image protocols/private literal image hosts;
- non-HTML responses and the 5 MB response bound;
- the hard scrape deadline, proven with a controlled clock and a slow-drip server through the actual `HttpService`, including that the origin connection is closed;
- the DNS-level SSRF guard over real sockets: a hostname that resolves to a loopback address is never connected to;
- every refused redirect target reporting `blocked_target`;
- the installed `cheerio`, `dompurify` and `jsdom` libraries executed directly: entity decoding, active-content and mutation-XSS stripping, multilingual and right-to-left text, first-title fallback, bounds and cache re-sanitisation;
- failure classification pinned against real axios and follow-redirects errors, and the exported Prometheus series through the real `MetricsService`;
- privacy-safe failure logging and network error normalization;
- persistence in `chat-link-preview.behaviour.spec.ts` and `secure-chat.service.link-preview.spec.ts`: the preview is written to the saved message before the realtime publication, a failed or throwing write still delivers the card live and logs only the message id, nothing is written when no preview resolves, encrypted direct and group messages are never previewed or stored, an edit stores the card in the same statement as the new text, replaces it for a new link, clears it when the link is removed or cannot be previewed, clears it in the statement that encrypts the message, and leaves the column alone when there is nothing to store or clear, and a forward stores the preview on every copy but never references the column when there is none;
- the `20261111000000_chat_message_link_preview` migration contract: idempotent additive column, once-only constraint, bounded object with a mandatory string `url` (a missing key must not pass as NULL), no plaintext preview on encrypted rows, and no validating scan under lock.

Focused Angular tests cover:

- safe HTTP and HTTPS destinations;
- rejection of script, data, mail, FTP, malformed, and credential-bearing URLs;
- equivalent validation for image URLs;
- plain-text metadata rendering and client-side length bounds;
- hostname fallback when site name is absent;
- query and fragment suppression in display chrome while preserving the actual destination;
- image-load failure and replacement behaviour;
- `noopener`, `noreferrer`, and no-referrer policy attributes;
- mixed-direction metadata and LTR URL presentation;
- `ChatMessageComponent` integration with an optional backend `link_preview` payload;
- `ChatRoomComponent` rendering a card for a message loaded from history, which is the path the stored preview now feeds, as well as for realtime publications and edits.

The repository backend/frontend completion gates remain authoritative for unit tests, builds, static analysis, lint, security checks, translation-safe component APIs, RTL checks, and design governance.

## Rollout and rollback

There is one additive schema migration, `supabase/migrations/20261111000000_chat_message_link_preview.sql`, and no data backfill, feature flag, or new environment variable. It adds the nullable `chat_messages.link_preview` JSONB column and the `chat_messages_link_preview_shape` check. Adding a nullable column without a default does not rewrite the table, and the check is added `NOT VALID` because every existing row is NULL, so the migration takes no validating scan under lock. It is safe to retry: the column uses `IF NOT EXISTS` and the constraint is created only when absent. The server-side bounds match the frontend limits already in production, so mixed frontend/backend versions remain compatible. Existing Redis entries are not migrated: they are validated under the new contract on read and naturally expire after the one-hour cache TTL.

Deploy order: apply the migration first, then the backend. The send paths tolerate the opposite order, because storing the preview is best effort and only logs `chat.link_preview_persist_failed`, and edits and sends of messages without a link never reference the column. A forward or edit that has a preview to store needs the column, so a backend deployed ahead of the migration fails those two operations until the migration lands. Older backend instances ignore the column, so mixed backend versions during a rolling deploy are safe.

Verify the focused link-preview and chat tests, confirm `hellotalk_link_preview_requests_total` appears on the metrics endpoint, check that `reason="timeout"` and `reason="unknown"` stay near zero and that `chat.link_preview_persist_failed` is absent from the logs, then deploy the frontend independently as needed. `LinkPreviewService` injects `MetricsService`, which the global `MetricsModule` already provides.

Rollback is code-first. Reverting the backend change stops new previews being stored and restores the earlier live-only behaviour, and older code ignores the stored cards. The column and constraint can stay in place. Dropping the column (`ALTER TABLE public.chat_messages DROP COLUMN link_preview`) only removes the stored cards and changes no other behaviour, but it is not needed for a rollback. Keeping the output bounds and cache validation in place is preferred because they protect the chat rendering boundary from oversized or corrupted metadata.
