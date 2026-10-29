# Rich link previews

## Scope

Text chat messages may include a single OpenGraph link preview supplied by the NestJS chat API. The backend remains authoritative for fetching external metadata through `LinkPreviewService`; Angular never fetches arbitrary third-party pages directly. `ChatMessageComponent` renders the optional payload through the shared `LinkPreviewCardComponent`.

The repository now has the complete #1426 production path: the authenticated NestJS OpenGraph scraper, Redis caching, chat payload integration, and the Angular rich-preview card. The frontend and backend contracts remain compatible: a preview contains `url`, `title`, `description`, `image`, and `siteName`, and messages continue to work when `link_preview` is absent. The resolved preview is published in realtime and also stored with the message (`chat_messages.link_preview`), so a client that loads history later, including every recipient who was offline when the message was sent, receives the same card. See [Persistence and history](#persistence-and-history).

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
- **Ordering.** When a preview resolves, it is stored before the message is published, so anything a client sees live is also in the history it loads later. The write is one `UPDATE ... WHERE id = ?` that sets an absolute value, so retrying it is harmless.
- **Best effort.** A failed write never fails the send. It is logged as `chat.link_preview_persist_failed message=<id> code=<database error code>` (no URL, title or database message) and the live event still carries the card; only history lacks it. An unmigrated database reports code `42703`.
- **Edits.** The stored preview follows the text. An edit that removes the link, or whose new link cannot be previewed, sets it to `null` (the realtime event already publishes an explicit `null`). A row that had no preview and still has none is not written.
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

Apart from the preview stored with its message (see [Persistence and history](#persistence-and-history)), link previews introduce no analytics, browser storage, or user profiling. The only third-party requests are the bounded backend page scrape and, when present, the browser image request required to render the preview.

## Observability

Every request is counted by outcome (`cache_hit`, `fetched`, `empty`, `rejected`, `failed`), every refusal or failure by a closed reason (`invalid_url`, `blocked_target`, `timeout`, `not_html`, `too_large`, `upstream_status`, `network`, `unknown`), and every origin scrape is timed. These are exported as `hellotalk_link_preview_requests_total`, `hellotalk_link_preview_failures_total` and `hellotalk_link_preview_fetch_duration_seconds`. Labels are closed enums, so no URL, hostname or provider message can reach the metrics endpoint. The reason catalogue, example PromQL and log format live in `backend/src/link-preview/README.md`.

Failure logs carry the hostname, a short URL fingerprint and the reason. Origin-caused reasons are logged at `warn`; only `unknown` is logged at `error`, so routine dead links do not hide real faults.

## Failure behaviour

Link-preview enrichment is optional. If the scraper cannot resolve metadata, the chat message is still delivered and rendered without a preview. Unsupported resources, malformed destinations, blocked network targets, timeouts (including the hard 8 second deadline), oversized pages, and other scrape failures return a stable bad-request response at the preview API boundary rather than exposing provider details.

If the preview cannot be stored, the message is delivered with its live preview and only history is missing the card (see [Persistence and history](#persistence-and-history)). If Redis is unavailable, the scraper fetches the origin directly and returns the fresh result without caching it. If a malformed, oversized, stale, or URL-mismatched cache entry is encountered, it is ignored and refreshed rather than trusted.

If a malformed or unsafe preview reaches the client through an older cache or realtime publication, the preview card fails closed while leaving the original message text visible. Image failures degrade to a text-only preview. No automatic retry loop is used in the browser, avoiding repeated requests to a failing external origin.

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
- persistence on direct send, group send, edit and forward, including that publication waits for the write, that a failing or throwing write never blocks delivery and is logged without the URL, and that client-supplied previews are never stored;
- clearing on edit, with no write when neither the row nor the new text has a preview;
- revalidation on read in history, search and export, executed with the real sanitiser: stale, orphaned, malformed, oversized and unsafe stored previews, link selection through punctuation and CJK text, and refusal of links the scraper would refuse;
- the migration contract: nullable additive column, guarded `CHECK` bounded to the application's cache bound, and no row rewrite.

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
- `ChatMessageComponent` integration with an optional backend `link_preview` payload.

The repository backend/frontend completion gates remain authoritative for unit tests, builds, static analysis, lint, security checks, translation-safe component APIs, RTL checks, and design governance.

## Rollout and rollback

The change is additive. Migration `supabase/migrations/20261029120000_chat_messages_link_preview.sql` adds the nullable `link_preview` column, its guarded `CHECK` constraint, and a restrictive insert policy that prevents authenticated direct clients from forging preview metadata. It rewrites no rows, is safe to run twice, and there is no feature flag or new environment variable.

1. Apply the migration, then deploy the backend. The frontend needs no change: it already renders `link_preview` from history and merges realtime events without discarding it, and its message cache expires after five minutes, so older cached histories refresh on their own.
2. Mixed versions are safe. Older backend instances ignore the column when writing, and return the stored object as the new code wrote it when they read it. A new instance that starts before the migration has been applied only fails its best-effort write (a `chat.link_preview_persist_failed ... code=42703` warning); reads are unaffected.
3. Verify after deploy: `chat.link_preview_persist_failed` warnings are absent, and `SELECT count(*) FROM public.chat_messages WHERE link_preview IS NOT NULL` grows as users send links. The scraper metrics are unchanged: confirm `hellotalk_link_preview_requests_total` appears on the metrics endpoint and that `reason="timeout"` and `reason="unknown"` stay near zero.

Rollback is code-only: revert the backend change. The column and constraint are inert when unused and can stay. Removing them is destructive and unnecessary for rollback; if ever required, do it only after every instance runs the reverted code:

```sql
DROP POLICY IF EXISTS chat_messages_link_preview_backend_only ON public.chat_messages;
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_link_preview_check;
ALTER TABLE public.chat_messages DROP COLUMN IF EXISTS link_preview;
```

Keep the server-side output bounds and cache validation in place on rollback: they protect the chat rendering boundary from oversized or corrupted metadata. Redis entries are validated under the same contract on read and expire after the one-hour cache TTL, so no cache clean-up is needed.
