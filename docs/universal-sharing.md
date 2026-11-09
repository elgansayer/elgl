# Universal in-app sharing and external deep linking

## Scope

The sharing engine gives every shareable entity a stable card, a canonical
OpenGraph URL and an app deep link. Supported entity types are:

| Entity type | Example source              | In-app route             | Deep link                          |
| ----------- | --------------------------- | ------------------------ | ---------------------------------- |
| `tutor`     | User or business profile    | `/profile/:id`           | `hellotalk://profile/:id`          |
| `group`     | Group chat                  | `/chat/:id`              | `hellotalk://chat/:id`             |
| `room`      | Live audio room             | `/preview/room/:id`      | `hellotalk://audio-rooms/:id`      |
| `moment`    | Moment post                 | `/moments?moment=:id`    | `hellotalk://moments/?moment=:id`  |
| `event`     | Language event              | `/events/:id`            | `hellotalk://events/:id`           |

The NestJS `SharingModule` is the single resolver for these types. The
frontend never reads entity tables directly.

## API

All routes live under the configured global `/api` prefix.

### `GET /api/sharing/preview/:entityType/:entityId`

Public. Returns a safe `SharePreview`:

```json
{
  "entityType": "tutor",
  "entityId": "9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f",
  "title": "Ana Spanish",
  "description": "Patient Spanish tutor",
  "imageUrl": "https://cdn.example.com/ana.png",
  "siteName": "HelloTalk",
  "shareUrl": "https://hellotalk.app/api/sharing/og/tutor/9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f",
  "webUrl": "/profile/9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f",
  "deepLink": "hellotalk://profile/9f1d0f8e-1d1f-4f1a-9e0e-1a2b3c4d5e6f",
  "pricing": {
    "ukp": 10,
    "usd": 12.5,
    "display": "10 UKP / 12.50 USD"
  }
}
```

`pricing` is `null` when the entity has no single-currency catalogue price.
Tutor pricing is read from the profile business catalogue and converted to the
dual-currency display used elsewhere in the product.

### `GET /api/sharing/og/:entityType/:entityId`

Public HTML. Serves OpenGraph and Twitter Card tags to crawlers, then uses a
zero-delay meta refresh to the `webUrl`. The document is escaped and bounded
before it is returned. Private audio rooms, hidden profiles and expired
ephemeral moments return `404` so their existence is not leaked.

### `GET /api/sharing/link/:entityType/:entityId`

Authenticated. Returns `{ shareUrl, webUrl, deepLink }` for the in-app share
sheet.

## Chat cards

`LinkPreviewService` recognises its own `/api/sharing/og/...` URLs, matched on
the configured app host, before any network request, so a look-alike
third-party URL can never be rendered as a branded HelloTalk card. A shared link therefore becomes a rich chat card even when the
API host is not reachable by the backend container. The published
`ChatMessage.link_preview.share` field carries the entity type, in-app route,
deep link and optional dual-currency price. `ShareCardComponent` renders that
payload as an internal, keyboard-accessible card. External links continue to
use the existing `LinkPreviewCardComponent`.

## Security and privacy

- Only the five entity types are accepted; ids are bounded and character
  restricted.
- Public previews expose only a title, short description, safe image URL and
  the share links. They never expose participant lists, private metadata or
  host identifiers.
- Tutor previews honour the profile's `hidden` and `vips_only` visibility and
  never expose deleted accounts or accounts scheduled for deletion. Private
  audio rooms and expired ephemeral moments return `404`.
- Image URLs must be ordinary public `http(s)` URLs without credentials.
- OpenGraph metadata is HTML escaped, so entity text cannot inject markup or
  script into the landing document.
- The preview and OpenGraph routes are throttled. No raw query strings or
  private content are logged by the share resolver.

## Failure behaviour

- Unknown type, unsafe id, missing entity, private entity, hidden profile or
  expired moment returns `404` with no sensitive detail.
- An unsupported catalogue currency omits pricing rather than guessing.
- When a shared URL cannot be resolved during chat delivery, preview
  enrichment fails closed and the message itself is still delivered.
- The OpenGraph route is read-only and has no mutation or retention behaviour.

## Verification

Focused backend tests cover entity resolution for every supported type, hidden
and expired targets, URL parsing, escaping, dual-currency rendering, preview and
link delegation, and DTO validation. Focused frontend tests cover the internal
share card, pricing display, unsafe image handling and the chat message branch.

## Rollout and rollback

This change is application-only. It adds no database migration, environment
variable or feature flag. `APP_URL` is used for canonical links when present,
falling back to `FRONTEND_URL`. Deploy the backend and frontend together or in
either order: extra preview fields are optional and older clients ignore them.

Rollback is code-only. Removing the `share` branch restores the previous
external link card without changing stored messages.
