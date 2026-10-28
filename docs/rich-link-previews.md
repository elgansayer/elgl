# Rich link previews

## Scope

Text chat messages may include a single OpenGraph link preview supplied by the NestJS chat API. The backend remains authoritative for fetching external metadata through `LinkPreviewService`; Angular never fetches arbitrary third-party pages directly. `ChatMessageComponent` renders the optional payload through the shared `LinkPreviewCardComponent`.

The repository now has the complete #1426 production path: the authenticated NestJS OpenGraph scraper, Redis caching, chat payload integration, and the Angular rich-preview card. The frontend and backend contracts remain compatible: a preview contains `url`, `title`, `description`, `image`, and `siteName`, and messages continue to work when `link_preview` is absent.

Previews are attached to direct sends, group sends, edits, and forwards. They are delivered in realtime only: the preview is not stored on the message row, so a card is absent once history is reloaded. See "Known limitation" below for the reason and the follow-up.

## Backend scraping contract

- The URL to preview is the first well-formed `http(s)` URL in the message text. It ends at whitespace, markup delimiters, typographic quotes, and CJK/Arabic/Indic sentence punctuation; trailing ASCII punctuation is dropped and a closing bracket is kept only when the URL opened it. A sentence such as "see https://example.com/post." previews `/post`.
- Only absolute `http:` and `https:` page URLs are accepted. Embedded credentials, non-default ports, localhost, literal private/link-local addresses, and overlong URLs are rejected before network access.
- Outbound HTTP uses guarded DNS lookup. If DNS returns multiple addresses, every returned address must be publicly routable; a single private/link-local result rejects the lookup. This avoids treating only the first address as authoritative. Multicast, reserved, broadcast, and documentation ranges are rejected, and IPv6 prefixes that embed an IPv4 address (IPv4-mapped, IPv4-translated, NAT64, 6to4) are judged by that embedded address. The IETF block is limited to `192.0.0.0/24` and `192.0.2.0/24`, so public hosts elsewhere in `192.0.0.0/16` (for example WordPress.com) can be previewed.
- Scrapes use a 5 second idle timeout per request leg and an 8 second budget for the whole scrape (the idle timer alone does not bound a response that keeps trickling bytes), follow at most three redirects, accept at most 5 MB, and require an HTML response.
- Script, style, and noscript nodes are removed before metadata extraction. OpenGraph fields fall back to the document title/description where appropriate.
- Metadata is plain-text sanitised and bounded server-side before it can enter Redis or a chat payload: title 300 characters, description 1,000 characters, and site name 200 characters.
- Preview image URLs must be HTTP(S), credential-free, use a default port, fit within the URL bound, and not use a literal private/link-local host. Unsafe image metadata is dropped without failing the message preview.
- Redis keys contain only a SHA-256 digest of the normalized page URL. Cached preview payloads are treated as untrusted: entries over 16 KiB, malformed JSON, mismatched page URLs, unsafe image URLs, or payloads without usable preview content are ignored and refreshed from origin.
- Cached metadata is re-sanitised and re-bounded on read. This keeps mixed-version or corrupted cache entries from bypassing the current output contract.
- Cache failures are best-effort. A Redis outage does not turn link enrichment into a chat-delivery failure.

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
- The card is a single keyboard-focusable link with a visible focus ring. Its accessible name is the visible text (site name, title, description, and address) followed by visually hidden, translated text ("Opens in a new tab", key `linkPreview.opensInNewTab`), because `target="_blank"` changes context. No `aria-label` replaces the visible text, so screen-reader users hear the same information sighted users read. The hint is not colour-dependent and wraps with the card at high zoom.

## Privacy and security

The card treats backend, cache, and Centrifugo payloads as untrusted input. Angular interpolation provides the final HTML escaping boundary, while the component also strips markup and rejects unsupported URL schemes before binding navigation or image URLs.

Both the outbound anchor and preview image use `referrerpolicy="no-referrer"`. Opening a preview therefore does not send the ELGL page URL as the HTTP referrer, and fetching a third-party OpenGraph image does not disclose the current chat route through the referrer header. The anchor also uses `noopener noreferrer` to prevent the opened page from controlling the ELGL window.

The backend does not log raw scraped URLs or provider error text. Diagnostics use the hostname plus a short SHA-256 URL fingerprint, which is sufficient to correlate failures without copying query strings, paths, credentials, or message content into logs.

No additional analytics, persistence, browser storage, or user profiling is introduced by link previews. The only third-party requests are the bounded backend page scrape and, when present, the browser image request required to render the preview.

## Failure behaviour

Link-preview enrichment is optional. If the scraper cannot resolve metadata, the chat message is still delivered and rendered without a preview. Unsupported resources, malformed destinations, blocked network targets, timeouts, oversized pages, and other scrape failures return a stable bad-request response at the preview API boundary rather than exposing provider details.

Editing a message re-resolves its preview after the ownership, edit-window, and membership checks, so an unauthorised caller cannot cause an outbound request. The edit event always includes `link_preview`; it is `null` when the new text has no previewable link or the scrape fails. Clients merge edit events over their local copy of the message, so a missing field would leave the previous card on screen. Forwards scrape the shared text once and publish the same preview to every target room.

An origin that is slow or trickles bytes is aborted by the 8 second overall budget and reported with the same stable bad-request error as other fetch failures; the chat message is still delivered without a card.

If Redis is unavailable, the scraper fetches the origin directly and returns the fresh result without caching it. If a malformed, oversized, stale, or URL-mismatched cache entry is encountered, it is ignored and refreshed rather than trusted.

If a malformed or unsafe preview reaches the client through an older cache or realtime publication, the preview card fails closed while leaving the original message text visible. Image failures degrade to a text-only preview. No automatic retry loop is used in the browser, avoiding repeated requests to a failing external origin.

## Known limitation: previews are realtime-only

`link_preview` is published through Centrifugo and returned from the HTTP endpoint, but it is not persisted on `chat_messages`. Cards therefore render for live messages and disappear when history is reloaded, and a recipient who opens the room later sees plain text.

Persisting it needs a nullable `chat_messages.link_preview JSONB` column. That is intentionally not bundled here: a schema change alters the generated Supabase types, which CI compares with `supabase/database-types.snapshot.json`, and that snapshot can only be regenerated against a clean database replay with Docker and the pinned Supabase CLI. The follow-up should add the idempotent migration (with a `NOT VALID` object-and-size `CHECK`, so the large table is not scanned under a long lock), commit the regenerated snapshot in the same pull request, and write the preview best-effort after the scrape in send, group send, edit, and forward so a backend deployed ahead of the migration still delivers messages. Deploy the migration first. Retention and deletion would follow the message row, which already covers hard deletes, account deletion, and disappearing-message purges.

## Observability

Two Prometheus series describe scraper health (see `backend/src/link-preview/README.md` for the full label vocabulary):

- `hellotalk_link_preview_requests_total{outcome,reason}`: `cache_hit`, `fetched`, `empty`, `rejected` (invalid URL or private network), and `failed` (timeout, blocked network, non-HTML, oversized, redirect, upstream status, network, other).
- `hellotalk_link_preview_fetch_duration_seconds{outcome}`: origin scrape latency, cache hits excluded.

Failure logs carry the hostname, a short URL fingerprint, and the same bounded reason, so one failing link can be correlated with a metric spike without exposing the URL, query string, or provider error text.

## Verification

Focused backend tests cover:

- malformed, overlong, private-network, credential-bearing, custom-port, and non-HTTP(S) page URLs;
- hashed cache keys and Redis outage degradation;
- cache URL binding, cache-size bounds, metadata re-sanitisation, and unsafe cached image rejection;
- OpenGraph extraction and title/description fallback;
- 300/1,000/200-character output bounds before caching;
- strict plain-text sanitisation and unsafe image protocols/private literal image hosts;
- non-HTML responses and the 5 MB response bound;
- privacy-safe failure logging and network error normalisation;
- first-URL selection around sentence, bracket, and CJK/Arabic/Indic punctuation;
- the 8 second overall abort signal, the guarded DNS lookup error code, and failure-reason metrics against the real Prometheus registry;
- multicast, reserved, TEST-NET, NAT64, 6to4, IPv4-translated, and Teredo address classification, plus the public `192.0.x.x` space that must stay reachable;
- send, group send, edit (explicit `null` preview), and forward integration, including authorisation before any scrape.

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
- the accessible link name (visible text plus the new-tab hint, no replacing `aria-label`) and keyboard focus semantics;
- how realtime edit events replace or clear a card, and why an omitted field keeps the old one;
- double-brace placeholders across the whole dictionary, so a single-brace key can never ship unsubstituted.

The repository backend/frontend completion gates remain authoritative for unit tests, builds, static analysis, lint, security checks, translation-safe component APIs, RTL checks, and design governance.

## Rollout and rollback

There is no schema migration, data backfill, feature flag, or new environment variable. The server-side bounds are additive hardening and match the frontend limits already in production, so mixed frontend/backend versions remain compatible. Existing Redis entries are not migrated: they are validated under the new contract on read and naturally expire after the one-hour cache TTL.

Deploy the backend normally, verify the focused link-preview tests and the `hellotalk_link_preview_*` metrics and log classifications (watch for a rise in `failed{reason="timeout"}` now that the 8 second budget applies), then deploy the frontend independently as needed. The new `linkPreview.opensInNewTab` string ships in the frontend dictionary; the unused `linkPreview.openLink` key was removed. Rollback is code-only. Reverting the backend change restores the previous cache-read behaviour; no persisted user data requires cleanup. Keeping the output bounds and cache validation in place is preferred because they protect the chat rendering boundary from oversized or corrupted metadata.
