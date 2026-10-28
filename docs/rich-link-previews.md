# Rich link previews

## Scope

Text chat messages may include a single OpenGraph link preview supplied by the NestJS chat API. The backend remains authoritative for fetching external metadata through `LinkPreviewService`; Angular never fetches arbitrary third-party pages directly. `ChatMessageComponent` renders the optional payload through the shared `LinkPreviewCardComponent`.

The repository now has the complete #1426 production path: the authenticated NestJS OpenGraph scraper, Redis caching, chat payload integration, and the Angular rich-preview card. The frontend and backend contracts remain compatible: a preview contains `url`, `title`, `description`, `image`, and `siteName`, and messages continue to work when `link_preview` is absent.

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

No additional analytics, persistence, browser storage, or user profiling is introduced by link previews. The only third-party requests are the bounded backend page scrape and, when present, the browser image request required to render the preview.

## Observability

Every request is counted by outcome (`cache_hit`, `fetched`, `empty`, `rejected`, `failed`), every refusal or failure by a closed reason (`invalid_url`, `blocked_target`, `timeout`, `not_html`, `too_large`, `upstream_status`, `network`, `unknown`), and every origin scrape is timed. These are exported as `hellotalk_link_preview_requests_total`, `hellotalk_link_preview_failures_total` and `hellotalk_link_preview_fetch_duration_seconds`. Labels are closed enums, so no URL, hostname or provider message can reach the metrics endpoint. The reason catalogue, example PromQL and log format live in `backend/src/link-preview/README.md`.

Failure logs carry the hostname, a short URL fingerprint and the reason. Origin-caused reasons are logged at `warn`; only `unknown` is logged at `error`, so routine dead links do not hide real faults.

## Failure behaviour

Link-preview enrichment is optional. If the scraper cannot resolve metadata, the chat message is still delivered and rendered without a preview. Unsupported resources, malformed destinations, blocked network targets, timeouts (including the hard 8 second deadline), oversized pages, and other scrape failures return a stable bad-request response at the preview API boundary rather than exposing provider details.

If Redis is unavailable, the scraper fetches the origin directly and returns the fresh result without caching it. If a malformed, oversized, stale, or URL-mismatched cache entry is encountered, it is ignored and refreshed rather than trusted.

If a malformed or unsafe preview reaches the client through an older cache or realtime publication, the preview card fails closed while leaving the original message text visible. Image failures degrade to a text-only preview. No automatic retry loop is used in the browser, avoiding repeated requests to a failing external origin.

## Verification

Focused backend tests cover:

- malformed, overlong, private-network, credential-bearing, custom-port, and non-HTTP(S) page URLs;
- hashed cache keys and Redis outage degradation;
- cache URL binding, cache-size bounds, metadata re-sanitisation, and unsafe cached image rejection;
- OpenGraph extraction and title/description fallback;
- 300/1,000/200-character output bounds before caching;
- strict plain-text sanitisation and unsafe image protocols/private literal image hosts;
- non-HTML responses and the 5 MB response bound;
- the hard scrape deadline, proven with a controlled clock and a slow-drip server through the actual `HttpService`, including that the origin connection is closed;
- the DNS-level SSRF guard over real sockets: a hostname that resolves to a loopback address is never connected to;
- every refused redirect target reporting `blocked_target`;
- the installed `cheerio`, `dompurify` and `jsdom` libraries executed directly: entity decoding, active-content and mutation-XSS stripping, multilingual and right-to-left text, first-title fallback, bounds and cache re-sanitisation;
- failure classification pinned against real axios and follow-redirects errors, and the exported Prometheus series through the real `MetricsService`;
- privacy-safe failure logging and network error normalization.

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

There is no schema migration, data backfill, feature flag, or new environment variable. The server-side bounds are additive hardening and match the frontend limits already in production, so mixed frontend/backend versions remain compatible. Existing Redis entries are not migrated: they are validated under the new contract on read and naturally expire after the one-hour cache TTL.

Deploy the backend normally, verify the focused link-preview tests, confirm `hellotalk_link_preview_requests_total` appears on the metrics endpoint, and check that `reason="timeout"` and `reason="unknown"` stay near zero, then deploy the frontend independently as needed. `LinkPreviewService` now injects `MetricsService`, which the global `MetricsModule` already provides. Rollback is code-only. Reverting the backend change restores the previous cache-read behavior; no persisted user data requires cleanup. Keeping the output bounds and cache validation in place is preferred because they protect the chat rendering boundary from oversized or corrupted metadata.
