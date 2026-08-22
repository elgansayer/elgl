# Link Preview (OpenGraph scraper)

The Link Preview module scrapes OpenGraph metadata from external URLs so the
app can render rich link cards inside chat messages and other surfaces.

## Endpoint

`GET /api/link-preview?url=<absolute http(s) url>`

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
   rejects private, loopback, link-local and reserved addresses (see
   `ip-guard.ts`) before the request is sent.
3. **Fetching:** the page is downloaded with a 5 second timeout, at most three
   redirects, and a 5 MB response size cap.
4. **Parsing:** `cheerio` extracts `og:title`, `og:description`, `og:image`
   and `og:site_name`, falling back to `<title>` and the `description` meta
   tag when OpenGraph tags are absent. Relative image URLs are resolved
   against the source page.
5. **Sanitisation:** all scraped text fields are run through a strict
   DOMPurify configuration that allows no tags and no attributes. Returned
   image URLs must also be ordinary public `http(s)` URLs; unsafe schemes,
   credentials, custom ports, localhost and private literal IPs are dropped.
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

## Tests

- `ip-guard.spec.ts`: SSRF IP classification (IPv4, IPv6, IPv4-mapped IPv6).
- `link-preview.service.spec.ts`: URL validation, SSRF boundaries, privacy-safe
  cache keys/logging, cache degradation, parsing, sanitisation, safe image
  handling and network error handling.
- `link-preview.controller.spec.ts`: query parameter validation and service
  delegation.

## Rollback

The change is application-only and has no schema migration. A rollback can
revert the service/tests/documentation commit. Redis entries using the `v2`
hashed namespace naturally expire after one hour and require no cleanup.
