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
   The same protocol, credential, host and port policy is re-applied to every
   redirect target before `follow-redirects` is allowed to continue, closing
   the redirect-to-private/custom-port bypass class.
3. **Fetching:** the page is downloaded as text with at most three redirects
   and a 5 MB response size cap. Two time limits apply. The 5 second axios
   `timeout` bounds connecting and waiting for response headers, and then acts
   only as an idle timer that every received byte resets. A hard 8 second
   deadline covers the whole scrape, redirects and body included. The deadline
   exists because a server that sends headers and then drips the body just
   inside the idle timer would otherwise hold the request, and the chat send
   awaiting it, open indefinitely. When it expires the request is cancelled and
   its socket destroyed.
4. **Parsing:** `cheerio` extracts `og:title`, `og:description`, `og:image`
   and `og:site_name`, falling back to the document `<title>` (the first
   `<title>` only, so inline SVG icon titles are not appended) and the
   `description` meta tag when OpenGraph tags are absent. Relative image URLs
   are resolved against the source page.
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
7. **Logging and metrics:** scraper diagnostics identify a target by hostname
   plus a short non-reversible URL fingerprint. Full URLs, query strings and
   raw upstream error messages are not written to application logs. See
   [Observability](#observability).

## Integration

`ChatService.sendMessage` calls `LinkPreviewService.getPreview` for the first
URL found in a text message and stores the result on the published
`ChatMessage.link_preview` field. The Angular `LinkPreviewCardComponent` then
renders that typed metadata as ordinary text and safe link/image attributes.
Unsafe destination/image URLs are suppressed in the component as a final
browser-side defence. If a remote preview image fails to load, only the image
is removed; the text/link card remains usable and a later replacement image can
render normally.

Preview scraping is best effort for chat delivery. A cache outage does not
prevent a fresh scrape, while invalid/unreachable external URLs follow the
existing service error contract.

## Failure and abuse behaviour

- Missing/malformed URLs and non-HTML responses return the existing 400-class
  scraper error rather than leaking provider details.
- Unauthenticated direct scraper requests are rejected before any network
  request is attempted.
- Excessive direct requests are throttled before they can amplify outbound
  network work.
- A redirect cannot switch to localhost, a private literal address, embedded
  credentials or a custom port. DNS resolution is still checked by the guarded
  HTTP(S) agents on every connection, including redirects.
- Redis failure degrades to an uncached fetch; it never weakens URL validation.
- Oversized pages, URLs and metadata are rejected or bounded before they can
  become unbounded cache/API payloads.
- A slow or stalled origin is abandoned at the 8 second deadline. Nothing is
  cached, the caller receives the same generic 400, and chat delivery carries on
  without a preview.
- Every refusal and failure is classified into a small closed set of reasons
  that feed both the logs and the metrics below.

## Observability

Each request ends in exactly one outcome, and refusals and failures also carry a
reason. Both are closed sets, so metric cardinality is bounded and neither can
contain a URL, hostname or upstream message.

| Outcome     | Meaning                                                |
| ----------- | ------------------------------------------------------ |
| `cache_hit` | A validated Redis entry answered the request.          |
| `fetched`   | The origin was scraped and produced a preview.         |
| `empty`     | The origin was scraped but exposed no usable metadata. |
| `rejected`  | The URL was refused before any network access.         |
| `failed`    | The origin scrape did not complete.                    |

| Reason            | Cause                                                              |
| ----------------- | ------------------------------------------------------------------ |
| `invalid_url`     | Malformed, overlong, non-http(s) or credential-bearing URL.        |
| `blocked_target`  | Custom port, private host, private DNS answer or refused redirect. |
| `timeout`         | Connect or idle timeout, or the 8 second hard deadline.            |
| `not_html`        | The origin answered with a non-HTML content type.                  |
| `too_large`       | The response exceeded the 5 MB bound.                              |
| `upstream_status` | The origin answered with an HTTP error status.                     |
| `network`         | DNS, connection, TLS or other transport failure.                   |
| `unknown`         | Anything unclassified. This is the only reason logged as an error. |

Prometheus series, exposed by `MetricsService`:

- `hellotalk_link_preview_requests_total{outcome}`: volume and cache efficiency.
- `hellotalk_link_preview_failures_total{reason}`: why previews are refused or
  fail.
- `hellotalk_link_preview_fetch_duration_seconds{outcome}`: origin scrape time
  for `fetched`, `empty` and `failed`, with buckets up to 10 seconds so the 8
  second deadline is visible.

Useful queries:

```promql
# Share of previews served from Redis
sum(rate(hellotalk_link_preview_requests_total{outcome="cache_hit"}[15m]))
  / sum(rate(hellotalk_link_preview_requests_total[15m]))

# Deadline hits: a rise suggests a slow-drip origin or an upstream regression
sum(rate(hellotalk_link_preview_failures_total{reason="timeout"}[15m]))

# SSRF probing: private hosts, ports, DNS answers and redirects being refused
sum(rate(hellotalk_link_preview_failures_total{reason="blocked_target"}[15m]))

# p95 origin scrape time
histogram_quantile(0.95, sum by (le) (rate(hellotalk_link_preview_fetch_duration_seconds_bucket[15m])))
```

Failure logs follow `Link-preview fetch failed (<host>#<fingerprint>; reason=<reason>; <ErrorName>)`.
The host and fingerprint correlate a failure with a report without exposing the
path or query. Expected, origin-caused reasons are logged at `warn`; only
`unknown` is logged at `error`, so dead links and non-HTML URLs do not drown out
real faults. `rejected` requests are counted but not logged, because they never
reach the network.

## Tests

- `ip-guard.spec.ts`: SSRF IP classification (IPv4, IPv6, IPv4-mapped IPv6).
- `link-preview.service.spec.ts`: URL validation, SSRF boundaries, privacy-safe
  cache keys/logging, cache degradation, parsing, sanitisation, safe image
  handling and network error handling.
- `link-preview.security.spec.ts`: redirect revalidation, metadata bounds and
  overlong image metadata.
- `link-preview.real-dependencies.spec.ts`: executes the installed `cheerio`,
  `dompurify` and `jsdom` packages directly. It proves entity decoding,
  active-content stripping (including a mutation-XSS vector), multilingual
  text, first-title fallback, bounds and cache re-sanitisation.
- `link-preview.resilience.spec.ts`: proves the hard deadline with a controlled
  clock and against a slow-drip server through the actual `HttpService`. It also
  covers the DNS guard over sockets, redirect refusal reasons, and
  outcome/reason accounting in metrics and logs.
- `link-preview-diagnostics.spec.ts`: failure classification, pinned against
  real axios and follow-redirects errors so a library upgrade cannot silently
  change the reasons.
- `link-preview.module.spec.ts`: module metadata, Nest dependency resolution
  with the real `MetricsService`, and the exported Prometheus series.
- `metrics/metrics.service.spec.ts`: the link-preview counters and histogram.
- `link-preview.controller.spec.ts`: authenticated endpoint ownership, query
  parameter validation and service delegation.
- `link-preview-card.component.spec.ts`: safe external-link rendering, unsafe
  URL suppression and broken/replacement image behaviour.

## Rollout and rollback

This is application-only and has no schema migration, environment variable or
feature flag. Deploy backend instances normally; mixed versions remain
compatible because the response interface and Redis namespace are unchanged.
`LinkPreviewService` now injects `MetricsService`, which `MetricsModule` provides
globally, so `LinkPreviewModule` needs no new import. After deploying, confirm
`hellotalk_link_preview_requests_total` appears on `/api/metrics` and that
`reason="timeout"` and `reason="unknown"` stay near zero.

Rollback can revert the controller/service/tests/documentation commits. The
security checks are intentionally fail-closed, so do not selectively remove
redirect validation or DNS guarding while leaving the public scraper exposed.
Removing the 8 second deadline restores the unbounded slow-drip exposure, so
prefer tuning `FETCH_DEADLINE_MS` over removing it. The metrics are additive:
reverting them leaves dashboards empty but changes no behaviour.
Redis entries in the `v2` namespace naturally expire after one hour and require
no cleanup.
