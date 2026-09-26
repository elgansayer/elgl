# Rich link previews

## Scope

Text chat messages may include a single OpenGraph link preview supplied by the NestJS chat API. The backend remains authoritative for fetching external metadata through `LinkPreviewService`; Angular never fetches arbitrary third-party pages directly. `ChatMessageComponent` renders the optional payload through the shared `LinkPreviewCardComponent`.

The production path is the authenticated NestJS OpenGraph scraper, Redis caching, chat payload integration, per-message persistence for chat history, and the Angular rich-preview card. The frontend and backend contracts remain compatible: a preview contains `url`, `title`, `description`, `image`, and `siteName`, and messages continue to work when `link_preview` is absent (or `null`, which clears a card after an edit).

The module-level reference for the backend (file map, metrics, failure table and limits) is `backend/src/link-preview/README.md`. This document describes the cross-cutting contract.

## Backend scraping contract

- Only absolute `http:` and `https:` page URLs are accepted. Embedded credentials, non-default ports, localhost, dotless service aliases, private-use suffixes (`.internal`, `.local`, `.lan`), literal private, link-local, reserved and multicast addresses (including IPv4-mapped, NAT64, 6to4 and Teredo IPv6 forms), and overlong URLs are rejected before network access.
- Outbound HTTP uses guarded DNS lookup. If DNS returns multiple addresses, every returned address must be publicly routable; a single private/link-local result rejects the lookup. The check runs when the socket is opened, so it validates the address actually dialled.
- **Redirects are revalidated.** DNS guarding cannot intercept a redirect to an IP literal, so every redirect target is checked with the same URL policy (scheme, credentials, port, private host) before the next hop is requested. At most three redirects are followed. Environment proxies are disabled so name resolution always happens in the guarded agents.
- Each scrape has a 5 second socket idle timeout and an 8 second wall-clock deadline covering redirects and the body, so an origin that trickles bytes cannot hold a connection open. Only the first 1 MiB of the body is read; the rest is abandoned and the connection is dropped. The response must be HTML or XHTML.
- The page is decoded with its declared charset (response header or `<meta>`), falling back to UTF-8. Script, style, and noscript nodes are removed before metadata extraction. OpenGraph fields fall back to the document title/description where appropriate. Relative image URLs resolve against the page that was actually served after redirects.
- Metadata is plain-text sanitised and bounded server-side before it can enter Redis or a chat payload: title 300 characters, description 1,000 characters, and site name 200 characters. Whitespace is collapsed and control characters and invisible bidi overrides are removed. Raw metadata is cut to four times its output limit before sanitising, and link extraction from chat text is a single linear pass, so hostile pages and hostile messages cannot burn synchronous CPU.
- Preview image URLs must satisfy the same URL policy as page URLs and fit within the URL bound. Unsafe image metadata is dropped without failing the message preview.
- Redis keys contain only a SHA-256 digest of the normalised page URL. Cached preview payloads are treated as untrusted: entries over 16 KiB, malformed JSON, mismatched page URLs, unsafe image URLs, or payloads without usable preview content are ignored and refreshed from origin.
- Cached metadata is re-sanitised and re-bounded on read. This keeps mixed-version or corrupted cache entries from bypassing the current output contract.
- Successful previews are cached for one hour. Failed and empty scrapes are cached for five minutes so a broken or repeatedly posted link does not hit the origin each time.
- Concurrent requests for the same URL share one origin scrape, and at most 20 origin scrapes run at once. Beyond that the API answers 503 and chat sends the message without a card.
- Cache failures are best-effort. A Redis outage does not turn link enrichment into a chat-delivery failure.

## Chat delivery and history

- Sending a text message extracts the first link (sentence punctuation, unbalanced brackets and CJK or full-width punctuation are not part of the link) and waits at most 3 seconds for a preview. A slow, blocked, broken or over-capacity link means the message is published without a card. The scrape keeps running within its own deadline, so its result is cached for the next request.
- The card a message was sent with is stored per message (`link_preview:message:v1:<message id>`, 30 day TTL) and attached by `GET /api/chat/messages/:roomId`, so the card is still there after a reload, on another device, and for participants who open the room later. Entries are re-validated on read and only shown while they still match the message's first link.
- Editing a message resolves the preview again for the new text. The published message always carries `link_preview` (`null` clears a card the text no longer supports) because clients merge edited messages into the ones they hold.
- Deleting a message for everyone removes its stored card. Forwarding a message copies the original's card without scraping again.
- Retention is 30 days per stored card; a missing card degrades to a plain text message. Messages sent before per-message persistence existed have no card and are not backfilled. A stored card holds only public page metadata under an opaque message id, with no sender or room identifier, so after account deletion or the retention purge removes the message rows the leftover entry cannot be tied to a person and expires within the TTL.

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

## Failure behaviour

Link-preview enrichment is optional. If the scraper cannot resolve metadata, the chat message is still delivered and rendered without a preview. Malformed or disallowed destinations, blocked network targets (including redirects), non-HTML resources, timeouts, and other scrape failures return a stable bad-request response at the preview API boundary rather than exposing provider details; a server at scrape capacity returns 503.

If Redis is unavailable, the scraper fetches the origin directly and returns the fresh result without caching it, and chat history simply shows messages without cards. If a malformed, oversized, stale, or URL-mismatched cache entry is encountered, it is ignored and refreshed rather than trusted.

If a malformed or unsafe preview reaches the client through an older cache or realtime publication, the preview card fails closed while leaving the original message text visible. Image failures degrade to a text-only preview. No automatic retry loop is used in the browser, avoiding repeated requests to a failing external origin.

## Observability

The scraper exports `hellotalk_link_preview_requests_total{outcome}`, `hellotalk_link_preview_fetch_duration_seconds{outcome}`, `hellotalk_link_preview_inflight_fetches` and `hellotalk_link_preview_persistence_total{operation,result}`. A sustained non-zero rate of `outcome="blocked"` means someone is aiming redirects or hostnames at private addresses. Failure logs use the hostname plus a short URL fingerprint and an `outcome=` classification, never the full URL, redirect target or upstream error text. See `backend/src/link-preview/README.md` for the outcome list and suggested alerts.

## Verification

Focused backend tests cover:

- malformed, overlong, private-network, credential-bearing, custom-port, and non-HTTP(S) page URLs, and every private, reserved, NAT64, 6to4 and Teredo address class;
- real-socket regressions for the fetch layer: a redirect to a private IP literal is refused and never contacted, a slow-drip origin is cut off at the deadline, oversized pages are truncated and the connection is dropped, hostnames resolving to loopback are refused, and proxy environment variables are ignored;
- hashed cache keys, negative caching, single-flight, the concurrency cap, the chat wait budget, and Redis outage degradation;
- cache URL binding, cache-size bounds, metadata re-sanitisation, and unsafe cached image rejection;
- OpenGraph extraction, title/description fallback, legacy charsets, and relative images resolved against the served page;
- 300/1,000/200-character output bounds, surrogate-safe truncation, bidi and control character removal;
- strict plain-text sanitisation and unsafe image protocols/private literal image hosts;
- non-HTML responses, outcome classification, metrics, and privacy-safe failure logging;
- chat send, history, edit, delete and forward behaviour including store failures.

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

There is no schema migration, data backfill, feature flag, or new environment variable. Per-message cards live in Redis (append-only persistence in the shipped compose files) because they are regenerable enrichment rather than message content, which also leaves the generated database types unchanged. The server-side bounds are additive hardening and match the frontend limits already in production, so mixed frontend/backend versions remain compatible. Existing URL cache entries are not migrated: they are validated under the new contract on read and naturally expire after the one-hour cache TTL.

Deploy the backend normally and watch `hellotalk_link_preview_requests_total` by outcome and the fetch duration histogram, then deploy the frontend independently as needed (no frontend change is required for history cards). Rollback is code-only. Reverting the backend restores the previous behaviour; cache and per-message entries expire on their own and need no cleanup. If rolling back part of this change, keep the redirect revalidation and the wall-clock deadline in place: they close a server-side request forgery path and a resource-exhaustion path respectively.
