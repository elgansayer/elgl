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

When the scraped page exposes no title, description or image, the endpoint
returns `null`.

## How it works

1. **URL validation:** only `http` and `https` protocols on the default ports
   are accepted; embedded credentials and custom ports are rejected.
2. **SSRF protection:** every DNS lookup is wrapped in `safeLookup`, which
   rejects private, loopback, link-local and reserved addresses (see
   `ip-guard.ts`) before the request is sent.
3. **Fetching:** the page is downloaded with a 5 second timeout, at most three
   redirects, and a 5 MB response size cap.
4. **Parsing:** `cheerio` extracts `og:title`, `og:description`, `og:image`
   and `og:site_name`, falling back to `<title>` and the `description` meta
   tag when OpenGraph tags are absent. Relative image URLs are resolved
   against the source page.
5. **Sanitisation:** scraped strings are run through a strict DOMPurify
   configuration that allows no tags and no attributes, so page content can
   never inject markup or scripts.
6. **Caching:** successful previews are cached in Redis under
   `link_preview:<url>` for one hour.

## Integration

`ChatService.sendMessage` calls `LinkPreviewService.getPreview` for the first
URL found in a text message and stores the result on the published
`ChatMessage.link_preview` field.

## Tests

- `ip-guard.spec.ts`: SSRF IP classification (IPv4, IPv6, IPv4-mapped IPv6).
- `link-preview.service.spec.ts`: URL validation, caching, parsing,
   sanitisation and error handling.
- `link-preview.controller.spec.ts`: query parameter validation and service
   delegation.
