# Link Preview (OpenGraph scraper)

The Link Preview module scrapes OpenGraph metadata from external URLs so the
app can render rich link cards inside chat messages and other surfaces.

## Endpoint

`GET /api/link-preview?url=<absolute http(s) url>`

The HTTP endpoint is authenticated with `SupabaseAuthGuard` and is limited to
30 requests per minute by the NestJS throttler. Internal backend callers such
as `ChatService` continue to call `LinkPreviewService` directly.

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
3. **Fetching:** the page is downloaded with a 5 second timeout, at most three
   redirects, and a 5 MB response size cap.
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
   non-reversible URL fingerprint. Full URLs, query strings and raw upstream
   error messages are not written to application logs.

## Integration

`ChatService.sendMessage` calls `LinkPreviewService.getPreview` for the first
URL found in a text message and stores the result on the published
`ChatMessage.link_preview` field. The Angular `LinkPreviewCardComponent` then
renders that typed metadata as ordinary text and safe link/image attributes.

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

## Tests

- `ip-guard.spec.ts`: SSRF IP classification (IPv4, IPv6, IPv4-mapped IPv6).
- `link-preview.service.spec.ts`: URL validation, SSRF boundaries, privacy-safe
  cache keys/logging, cache degradation, parsing, sanitisation, safe image
  handling and network error handling.
- `link-preview.security.spec.ts`: redirect revalidation, metadata bounds and
  overlong image metadata.
- `link-preview.controller.spec.ts`: authentication metadata, query parameter
  validation and service delegation.

## Rollout and rollback

This is application-only and has no schema migration. Deploy backend instances
normally; mixed versions remain compatible because the response interface and
Redis namespace are unchanged. Existing internal callers are unaffected by the
new controller guard.

Rollback can revert the controller/service/tests/documentation commits. The
security checks are intentionally fail-closed, so do not selectively remove
redirect validation or DNS guarding while leaving the public scraper exposed.
Redis entries in the `v2` namespace naturally expire after one hour and require
no cleanup.
