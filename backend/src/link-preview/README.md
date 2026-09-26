# Link Preview (OpenGraph scraper)

The Link Preview module scrapes OpenGraph metadata from external URLs so the
app can render rich link cards inside chat messages. The backend is the only
component that fetches third-party pages; Angular never does.

## Endpoint

`GET /api/link-preview?url=<absolute http(s) url>`

The endpoint is protected by `SupabaseAuthGuard` and limited to 20 requests per
minute by the NestJS throttler. Normal chat delivery does not make an extra HTTP
request: `ChatService` calls `LinkPreviewService` directly on the server.

```json
{
  "url": "https://example.com/post",
  "title": "Great Article",
  "description": "A description",
  "image": "https://example.com/img/cover.png",
  "siteName": "Example"
}
```

| Status | Meaning |
| --- | --- |
| 200 with a preview | Metadata was found (fresh, or served from the cache) |
| 200 with `null` | The page is HTML but exposes no title, description or safe image |
| 400 | Missing, repeated, malformed, or disallowed URL; or the page could not be fetched |
| 503 | The server is already running the maximum number of scrapes; retry shortly |

## Files

| File | Responsibility |
| --- | --- |
| `link-preview-url.ts` | The URL policy, and extracting the first link from chat text |
| `ip-guard.ts` | Classifies IPv4 and IPv6 addresses that must never be dialled |
| `safe-html-fetch.ts` | The untrusted network fetch: guarded DNS, redirect checks, deadline, byte cap |
| `link-preview.service.ts` | Orchestration: caches, single-flight, parsing, sanitising, metrics |
| `message-link-preview.store.ts` | The card a message was sent with, kept for chat history |
| `link-preview.controller.ts` | The authenticated HTTP endpoint |

## How a scrape works

1. **URL policy** (`parseLinkPreviewUrl`): only `http` and `https`, default ports
   only, no embedded credentials, at most 2,048 characters. Literal private,
   loopback, link-local, reserved and multicast addresses (including IPv4-mapped,
   NAT64, 6to4 and Teredo IPv6 forms) are refused, as are `localhost`, dotless
   service aliases such as `backend`, and private-use suffixes such as
   `.internal`, `.local` and `.lan`.
2. **Guarded DNS**: every connection resolves through `guardedLookup`, which
   refuses any name that resolves to a non-public address. It runs when the
   socket is opened, so it checks the address that is actually dialled and
   leaves no gap for DNS rebinding.
3. **Redirect revalidation**: DNS guarding cannot see a redirect to an IP
   literal, because there is no lookup to intercept. Each redirect target is
   therefore checked with the same URL policy in a `beforeRedirect` hook
   before the next hop is requested. A public page that answers
   `302 Location: http://169.254.169.254/` is refused and the internal address
   is never contacted. At most three redirects are followed.
4. **Bounded fetch**: a socket idle timeout of 5 seconds, a wall-clock deadline
   of 8 seconds for the whole scrape (redirects and body included, so an origin
   that trickles bytes cannot hold a connection open), and only the first 1 MiB
   of the body is read before the connection is dropped. Environment proxies
   are disabled so name resolution always happens in the guarded agents.
5. **Parsing**: the page is decoded using its declared charset (response header
   or `<meta>`), falling back to UTF-8, so Shift_JIS, GBK and Latin-1 pages
   produce readable titles. `og:title`, `og:description`, `og:image` and
   `og:site_name` are read, with `<title>` and the `description` meta tag as
   fallbacks. Relative image URLs resolve against the page that was actually
   served, which differs from the requested URL when a shortener redirected.
6. **Sanitising**: text fields go through a strict DOMPurify configuration that
   allows no tags or attributes, then whitespace is collapsed and control
   characters and invisible bidi overrides are removed (a hostile page could
   otherwise reorder or hide card text). Fields are bounded to 300, 1,000 and
   200 characters without splitting surrogate pairs. Raw metadata is first cut
   to four times its output limit and image URLs longer than 2,048 characters
   are dropped unparsed, so a hostile page cannot make the synchronous
   sanitiser or URL parser chew through megabytes. Image URLs must satisfy the
   URL policy or they are dropped.

## Caching, deduplication and abuse limits

- **Positive cache**: successful previews are cached for one hour under
  `link_preview:v2:<sha256 of the normalised URL>`. Cached JSON is treated as
  untrusted and re-validated on every read (size, shape, URL binding and the
  same sanitising as a fresh scrape).
- **Negative cache**: failed and empty scrapes are remembered for five minutes
  under `link_preview:v2:negative:<digest>` so a broken link, or a link posted
  repeatedly, does not hit the origin every time. The server's own capacity
  limit is never cached as if the page had failed.
- **Single-flight**: concurrent requests for the same URL share one origin scrape.
- **Concurrency cap**: at most 20 origin scrapes run at once. Beyond that the
  request fails fast (503 from the API, no card in chat) instead of queueing.
- Redis read and write failures are best effort and never fail a request.
- Keys contain only a hash, so private query strings are never copied into Redis
  keys.

## Chat integration

`ChatService.sendMessage` extracts the first link from a text message
(`extractFirstHttpUrl` drops sentence punctuation and unbalanced brackets, and
stops at CJK and full-width punctuation) and asks `LinkPreviewService` for a
preview with a 3 second wait budget. Extraction runs on every message of up to
10,000 untrusted characters, so it is a single linear pass; regression tests
pin this because a backtracking version blocked the event loop for over a
second on hostile input:

- A slow origin cannot delay delivery. After the budget the message is
  published without a card; the scrape carries on within its own deadline so its
  result is cached for the next request.
- A blocked, broken, empty or over-capacity link also yields no card. Enrichment
  never fails a message.
- The message is saved first, the card is stored, then the message is published
  with `link_preview` attached.

### Chat history (per-message persistence)

A card is derived data, but users expect it to still be there when they reopen
the conversation, use another device, or join later. `MessageLinkPreviewStore`
keeps the card a message was sent with:

- Key `link_preview:message:v1:<message id>`, 30 day TTL. The shipped compose
  stack runs Redis with append-only persistence. There is no schema migration,
  so the generated database types are unchanged.
- `ChatService.getMessages` loads the cards for a page of messages with one
  `MGET` and attaches them as `link_preview`.
- An entry is only shown while it still matches the message's current first
  link, and it is re-validated on read, so an edit that changes the link (or a
  corrupted entry) can never show a wrong or unsafe card.
- **Edit**: the preview is resolved again for the new text, and `link_preview`
  is always published explicitly (`null` clears a card the text no longer
  supports), because clients merge edited messages into the ones they hold.
- **Delete for everyone**: the stored card is removed. Deleting only for oneself
  keeps it, because other participants still see the message.
- **Forward**: the copy keeps the original's card without scraping again.
- **Retention**: entries expire 30 days after they were written. A missing entry
  degrades to a plain text message. Messages sent before this store existed have
  no card, and there is no backfill.
- **Erasure**: an entry holds only public page metadata under an opaque message
  id and never a sender or room identifier. When account deletion or the
  retention purge removes the message rows, the leftover entry cannot be tied
  to a person and expires within the 30 day TTL, so those flows need no extra
  cleanup step.
- Storage estimate: roughly 0.5 to 3.5 KB per message that contains a link
  (bounded by the field limits above). Store failures never affect delivery.

## Observability

Prometheus metrics (via `MetricsService`, exposed at the existing metrics
endpoint):

| Metric | Labels | Use |
| --- | --- | --- |
| `hellotalk_link_preview_requests_total` | `outcome` | One increment per request, by outcome as the caller saw it |
| `hellotalk_link_preview_fetch_duration_seconds` | `outcome` | Latency of origin scrapes |
| `hellotalk_link_preview_inflight_fetches` | none | Scrapes running now (cap is 20) |
| `hellotalk_link_preview_persistence_total` | `operation`, `result` | Per-message store activity (`save`, `load`, `remove`) |

`outcome` is one of `cache_hit`, `negative_hit`, `fetched`, `empty`,
`invalid_url`, `blocked`, `not_html`, `timeout`, `upstream_error`,
`network_error`, `busy`, `wait_timeout`.

Suggested alerts:

- `sum(rate(hellotalk_link_preview_requests_total{outcome="blocked"}[5m])) > 0.1`
  for sustained SSRF probing (a redirect or hostname aimed at a private address).
- `sum(rate(hellotalk_link_preview_requests_total{outcome="busy"}[5m])) > 0` for
  the concurrency cap being hit.
- p95 of `hellotalk_link_preview_fetch_duration_seconds` for slow origins.
- `hellotalk_link_preview_persistence_total{result="error"}` for Redis trouble.

Logs identify a target by hostname plus a short non-reversible URL fingerprint
(`example.com#2ab46739f099`). Full URLs, query strings, redirect targets and raw
upstream error text are never logged. A failed scrape logs one line such as
`Link-preview fetch failed (example.com#2ab46739f099; outcome=blocked; reason=private_host)`,
which is enough to correlate a user report with metrics without database access.

## Failure behaviour

| Situation | Outcome | API result | Chat result | Cached for |
| --- | --- | --- | --- | --- |
| Invalid or disallowed URL | `invalid_url` | 400 with the reason | No card | Not cached |
| Redirect or DNS answer points at a private address | `blocked` | 400 | No card | 5 minutes |
| Not an HTML response | `not_html` | 400 | No card | 5 minutes |
| Socket idle timeout or 8 second deadline | `timeout` | 400 | No card | 5 minutes |
| HTTP error status or too many redirects | `upstream_error` | 400 | No card | 5 minutes |
| DNS or connection failure | `network_error` | 400 | No card | 5 minutes |
| HTML without usable metadata | `empty` | 200 `null` | No card | 5 minutes |
| Server at scrape capacity | `busy` | 503 | No card | Not cached |
| Slow origin, chat wait budget spent | `wait_timeout` | n/a | No card, scrape continues | Result cached when it finishes |
| Redis unavailable | as above | as above | as above | Nothing cached |

## Configuration

There are no environment variables. The limits are constants in
`safe-html-fetch.ts`, `link-preview.service.ts`,
`message-link-preview.store.ts` and `chat.service.ts` so they change through
code review.

## Known limitations

- Recipients' browsers load the preview image directly from the third-party
  host, which discloses the reader's IP address to that host. The image and
  link use `referrerpolicy="no-referrer"`. Re-hosting images through R2 would
  remove this and is not part of this module.
- A card that finishes after the 3 second chat budget does not appear on the
  message that started it; there is no follow-up realtime update.

## Tests

- `ip-guard.spec.ts`: address classification (IPv4, IPv6, mapped, NAT64, 6to4,
  Teredo, multicast, documentation and reserved ranges).
- `link-preview-url.spec.ts`: the URL policy, redirect target checks, and link
  extraction from chat text including CJK punctuation.
- `safe-html-fetch.spec.ts`: real local HTTP servers. It proves that a redirect
  to a private IP literal is refused and never contacted, that a slow-drip
  origin is cut off at the deadline, that oversized pages are truncated and the
  connection dropped, that hostnames resolving to loopback are refused, and that
  proxy environment variables are ignored.
- `link-preview.service.spec.ts`: extraction, charsets, sanitising, caching,
  negative caching, single-flight, the concurrency cap, the wait budget, error
  classification and privacy of logs.
- `message-link-preview.store.spec.ts`: persistence, URL binding, re-validation
  and Redis failure handling.
- `link-preview.controller.spec.ts`, `link-preview.module.spec.ts`,
  `link-preview.contract.spec.ts`: endpoint ownership, wiring and contracts.
- `../chat/chat-link-preview.behaviour.spec.ts`: send, history, edit, delete and
  forward integration.
- `link-preview-card.component.spec.ts` (frontend): safe rendering of the card.

## Rollout and rollback

The change is application-only: no schema migration, feature flag or new
environment variable. Deploy the backend normally, then watch
`hellotalk_link_preview_requests_total` by outcome and the fetch duration
histogram. The frontend needs no change because history now carries the same
`link_preview` field that live messages already had.

Rollback is a code revert. Redis entries (`link_preview:v2:*`,
`link_preview:v2:negative:*` and `link_preview:message:v1:*`) expire on their own
within 30 days and need no cleanup. Keep the redirect revalidation and deadline
in place if partially rolling back, since they close a server-side request
forgery path.
