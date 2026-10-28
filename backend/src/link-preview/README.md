# Link Preview (OpenGraph scraper)

The Link Preview module scrapes OpenGraph metadata from external URLs so the
app can render rich link cards inside chat messages and other surfaces.

## Endpoint

`GET /api/link-preview?url=<absolute http(s) url>`

The HTTP endpoint is authenticated with `SupabaseAuthGuard` and is limited to
30 requests per minute by the NestJS throttler. Internal backend callers such
as `ChatService` continue to call `LinkPreviewService` directly, so normal chat
delivery does not make an extra HTTP request.

Returns a `LinkPreview` object:

```json
{
  "url": "https://example.com/post",
  "title": "Great Article",
  "description": "A description",
  "image": "https://example.com/img/cover.png",
  "siteName": "Example"
}
```

When the scraped page exposes no title, description or safe image, the endpoint
returns `null`.

## How it works

1. **URL validation:** only `http` and `https` protocols on the default ports
   are accepted; embedded credentials, private literal hosts, localhost,
   overlong URLs and custom ports are rejected.
2. **SSRF protection:** every DNS lookup is wrapped in `safeLookup`, which
   rejects the complete set of private, loopback, link-local and reserved
   addresses returned by DNS (see `ip-guard.ts`) before the request is sent.
   The guard covers the RFC 1918, loopback, link-local, carrier-grade NAT,
   benchmarking, multicast, reserved/broadcast and documentation (TEST-NET)
   IPv4 ranges plus the IPv6 unique-local, link-local, site-local and multicast
   ranges. IPv6 prefixes that embed an IPv4 address (IPv4-mapped,
   IPv4-translated, NAT64 `64:ff9b::/96` and 6to4 `2002::/16`) are judged by the
   embedded IPv4 address, so a NAT64 gateway cannot be used to reach a private
   host; Teredo, local-use NAT64 and discard-only prefixes are rejected
   outright. The IETF protocol block is limited to `192.0.0.0/24` and
   `192.0.2.0/24`: the rest of `192.0.0.0/16` is ordinary public space (for
   example WordPress.com in `192.0.64.0/18`) and stays previewable. The same
   protocol, credential, host and port policy is re-applied to every redirect
   target before `follow-redirects` is allowed to continue, closing the
   redirect-to-private/custom-port bypass class.
3. **Fetching:** the page is downloaded with a 5 second idle timeout per request
   leg, an 8 second budget for the whole scrape (DNS, every redirect and the
   body), at most three redirects, and a 5 MB response size cap. Axios treats
   `timeout` as an idle timer only, so the overall budget is enforced with an
   `AbortSignal`; without it an origin that trickles bytes could hold a chat
   send open until the size cap was reached. A deadline abort surfaces with the
   same stable bad-request error as other fetch failures.
4. **Parsing:** `cheerio` extracts `og:title`, `og:description`, `og:image`
   and `og:site_name`, falling back to `<title>` and the `description` meta
   tag when OpenGraph tags are absent. Relative image URLs are resolved
   against the source page.
5. **Sanitisation and output bounds:** all scraped text fields are run through
   a strict DOMPurify configuration that allows no tags and no attributes.
   Titles are capped at 300 characters, descriptions at 1,000 and site names
   at 200 before they reach Redis or an API response. Returned image URLs must
   also be ordinary public `http(s)` URLs, fit inside the 2,048-character URL
   bound, and cannot contain credentials, custom ports, localhost or private
   literal IPs.
6. **Caching:** successful previews are cached for one hour. Cache keys contain
   only a SHA-256 digest of the normalized URL (`link_preview:v2:<digest>`),
   so private query strings are not copied into Redis keys. Redis read/write
   failures are best-effort and do not make a valid chat message fail.
7. **Logging:** scraper diagnostics identify a target by hostname plus a short
   non-reversible URL fingerprint and a bounded `reason=` classification
   (`timeout`, `blocked_network`, `non_html`, `too_large`, `redirect`,
   `upstream_status`, `network` or `other`). Full URLs, query strings and raw
   upstream error messages are not written to application logs.

## Integration

**URL selection.** `extractFirstHttpUrl` (`link-url.ts`) picks the first
well-formed `http(s)` URL in a message. A URL ends at whitespace, markup
delimiters, typographic quotes and the sentence punctuation of CJK, Arabic and
Indic scripts (which are rarely preceded by a space). Trailing ASCII sentence
punctuation is dropped, and a closing bracket is kept only when the URL opened
it (`/wiki/Rust_(language)`). "Read https://example.com/post." therefore
scrapes `/post`, not `/post.`, and "請看https://example.com/post。謝謝" no
longer drags the Chinese sentence into the request. Protocol, host, port and
credential policy stays in `LinkPreviewService`, which re-validates every URL.

**Chat entry points.** `ChatService.resolveLinkPreview` combines the extractor
with `LinkPreviewService.getPreview` and swallows every failure, because a
preview is enrichment and must never block delivery. It is used by:

- `ChatService.sendMessage` (direct chats) and `SecureChatService.sendMessage`
  (group chats): the preview is attached to the published and returned
  `ChatMessage.link_preview`.
- `ChatService.editMessage`: scraped only after the ownership, edit-window and
  membership checks pass, so an unauthorised caller cannot trigger an outbound
  request. The edit event always carries `link_preview`, set to `null` when the
  new text has no previewable link. Realtime clients merge edit events over
  their local copy of the message, so omitting the field would leave the card
  for the old link on screen.
- `ChatService.forwardMessage`: the forwarded text is identical in every target
  room, so it is scraped once and the same preview is published to each room.

The Angular `LinkPreviewCardComponent` renders that typed metadata as ordinary
text and safe link/image attributes. Unsafe destination/image URLs are
suppressed in the component as a final browser-side defence. If a remote
preview image fails to load, only the image is removed; the text/link card
remains usable and a later replacement image can render normally. The link's
accessible name is its visible text plus a visually hidden "Opens in a new tab"
hint, because `target="_blank"` changes context.

Preview scraping is best effort for chat delivery. A cache outage does not
prevent a fresh scrape, while invalid/unreachable external URLs follow the
existing service error contract.

### Known limitation: previews are realtime-only

`link_preview` travels on the Centrifugo publication and the HTTP response but
is not stored on the `chat_messages` row, so a card shows for live messages and
is absent after history is reloaded. Durable persistence needs a nullable
`chat_messages.link_preview JSONB` column (bounded to 16 KiB, written
best-effort after the scrape and cleared when an edit removes the link). It is
deliberately not part of this change: a schema change alters the generated
Supabase types, and CI compares them with
`supabase/database-types.snapshot.json`, which can only be regenerated against a
clean replay using Docker and the pinned Supabase CLI. Follow-up checklist:

1. Add the migration (idempotent `ADD COLUMN IF NOT EXISTS`, `NOT VALID` object
   and size `CHECK` so the hot table is not scanned under a long lock).
2. Regenerate and commit `supabase/database-types.snapshot.json` in the same PR.
3. Persist the preview in `sendMessage`, group send, `editMessage` and
   `forwardMessage` with a best-effort second write, so a deploy that reaches
   production before the migration still delivers messages.
4. Deploy order: migration first, then the backend. Retention and deletion
   follow the message row (hard delete, GDPR deletion and disappearing-message
   purges already remove the whole row).

## Failure and abuse behaviour

- Missing/malformed URLs and non-HTML responses return the existing 400-class
  scraper error rather than leaking provider details.
- Unauthenticated direct scraper requests are rejected before any network
  request is attempted.
- Excessive direct requests are throttled before they can amplify outbound
  network work.
- A slow or trickling origin is cut off by the 8 second overall budget, so one
  hostile page cannot hold a chat send open.
- Edits are authorised before any outbound request is made.
- A redirect cannot switch to localhost, a private literal address, embedded
  credentials or a custom port. DNS resolution is still checked by the guarded
  HTTP(S) agents on every connection, including redirects.
- Redis failure degrades to an uncached fetch; it never weakens URL validation.
- Oversized pages, URLs and metadata are rejected or bounded before they can
  become unbounded cache/API payloads.

## Observability

Prometheus series are exposed through the global `MetricsService`. The scraper
treats it as an optional dependency, so it can still be constructed without one
(unit tests, scripts).

| Metric | Labels | Meaning |
| --- | --- | --- |
| `hellotalk_link_preview_requests_total` | `outcome`, `reason` | One increment per request. `outcome` is `cache_hit`, `fetched`, `empty` (the page had no usable metadata), `rejected` (the URL failed validation; `reason` is `private_network` or `invalid_url`) or `failed` (`reason` is `timeout`, `blocked_network`, `non_html`, `too_large`, `redirect`, `upstream_status`, `network` or `other`). `reason` is `none` for the other outcomes. |
| `hellotalk_link_preview_fetch_duration_seconds` | `outcome` | Origin scrape latency for `fetched`, `empty` and `failed`. Cache hits are excluded. Buckets run from 0.1 s to 10 s around the 8 s budget. |

Useful signals: a rising `rejected{reason="private_network"}` or
`failed{reason="blocked_network"}` rate indicates SSRF probing through chat;
`failed{reason="timeout"}` rising while volume is flat points at slow origins
or an egress problem; the `cache_hit` share shows how well the one-hour cache is
absorbing repeated links. Every label value comes from a fixed vocabulary, so
cardinality is bounded and no URL or provider text reaches a label.

## Tests

- `ip-guard.spec.ts`: SSRF IP classification (IPv4, IPv6, IPv4-mapped IPv6,
  multicast/reserved/TEST-NET, NAT64, 6to4, SIIT, Teredo) and the public
  `192.0.0.0/16` space that must stay reachable.
- `link-url.spec.ts`: first-URL selection, trailing punctuation, balanced
  brackets and CJK/Arabic/Indic punctuation.
- `link-preview.observability.spec.ts`: overall deadline, guarded DNS lookup,
  outcome and failure-reason metrics, privacy-safe failure logs and the real
  Prometheus registry wiring.
- `link-preview.service.spec.ts`: URL validation, SSRF boundaries, privacy-safe
  cache keys/logging, cache degradation, parsing, sanitisation, safe image
  handling and network error handling.
- `link-preview.security.spec.ts`: redirect revalidation, metadata bounds and
  overlong image metadata.
- `link-preview.controller.spec.ts`: authenticated endpoint ownership, query
  parameter validation and service delegation.
- `link-preview-card.component.spec.ts`: safe external-link rendering, unsafe
  URL suppression, broken/replacement image behaviour and the accessible link
  name (visible text plus the new-tab hint).
- `chat/chat-link-preview.behaviour.spec.ts` and
  `chat/secure-chat.service.link-preview.spec.ts`: send, edit, forward and group
  send integration, including explicit `null` previews on edit and
  authorisation before scraping.
- `chat-room-realtime.spec.ts` (frontend): how edit events replace or clear a
  card.

## Rollout and rollback

This is application-only and has no schema migration. Deploy backend instances
normally; mixed versions remain compatible because the response interface and
Redis namespace are unchanged. Existing internal callers are unaffected by the
new controller guard. The edit event now always includes `link_preview`; older
frontends already treat the field as optional and nullable. After deploy, watch
`hellotalk_link_preview_requests_total` for a spike in
`failed{reason="timeout"}` (the 8 second budget is new) and for
`rejected{reason="private_network"}`.

Rollback can revert the controller/service/tests/documentation commits. The
security checks are intentionally fail-closed, so do not selectively remove
redirect validation, DNS guarding or the overall deadline while leaving the
public scraper exposed. Reverting only the edit change brings back stale cards
after an edit; reverting the metrics removes the series but changes no
behaviour.
Redis entries in the `v2` namespace naturally expire after one hour and require
no cleanup.
