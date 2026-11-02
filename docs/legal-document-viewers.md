# Terms and Privacy document viewers

## Scope

The public `/terms` and `/privacy` routes render the canonical Terms of Service and Privacy Policy before or after sign-in. Both routes load the shared `DynamicLegalComponent`, which delegates presentation to `LegalDocumentViewerComponent`. The canonical NestJS endpoints are `GET /legal/terms` and `GET /legal/privacy`; `GET /legal/terms-of-service` and `GET /legal/privacy-policy` are supported aliases for `/legal/:type` clients.

The backend remains the single source of truth for document text and effective dates. No legal text is persisted in browser storage, Supabase, or a user profile.

## Request and rendering contract

1. Angular binds the canonical route data or the `/legal/:type` URL parameter to `DynamicLegalComponent`, then requests the matching `/legal/:type` endpoint through `LegalService`.
2. The client treats the HTTP body as untrusted data and validates it before rendering:
   - title: non-empty, at most 160 characters;
   - effective date: a real `YYYY-MM-DD` calendar date;
   - sections: 1-64 entries;
   - section ids: unique, URL-fragment-safe lower-case identifiers;
   - headings: non-empty, at most 240 characters;
   - section content: non-empty, at most 20,000 characters per section.
3. Invalid payloads fail into the same retryable unavailable state as a network failure. The UI never renders a partially accepted document.
4. Headings and content use Angular text interpolation, not `[innerHTML]`, so legal document strings cannot create executable markup.
5. The shared viewer exposes an `On this page` landmark with stable fragment links and matching section ids. The current effective date is rendered with a machine-readable `<time datetime="YYYY-MM-DD">` value.

The backend legal endpoints are intentionally public because account creation and informed consent must not depend on authentication. Responses are cacheable for five minutes and may be served stale while revalidation occurs for up to one day. Changing legal text therefore requires updating the configured effective date and accounting for that bounded cache window.

## Effective-date configuration

`TOS_EFFECTIVE_DATE` and `PRIVACY_EFFECTIVE_DATE` may override the bundled effective date. Values must be real ISO calendar dates in `YYYY-MM-DD` form. Missing or malformed configuration falls back to the bundled `2026-07-01` date and emits a sanitized warning containing only the configuration key, never document or user content.

## Accessibility and responsive behavior

- The document has one labelled `main` landmark and one `h1`.
- The table of contents is a labelled `nav`; links are native anchors with keyboard-visible focus and touch-friendly height.
- Each section is labelled by its own `h2`, allowing screen-reader heading navigation and stable deep linking.
- Important state is conveyed through text and semantic roles rather than colour alone.
- Loading uses `aria-busy` plus a polite status message; failure uses `role="alert"` and a keyboard-operable retry button.
- Layout remains a single bounded text column and uses Relay semantic surface/text tokens so light/dark themes, user accent, zoom and narrow viewports remain compatible.

## Privacy and security

The endpoints return static policy content only and require no account identifiers. The `type` path parameter is untrusted input: the backend accepts only `terms`, `terms-of-service`, `privacy`, and `privacy-policy`, bounds its length, and returns a sanitised 404 for every other value. The frontend does not log, cache in local storage, or send analytics containing the legal document body. Runtime response validation bounds memory/rendering work and rejects malformed fragments before they can affect document navigation.

The backend should not be changed to serve arbitrary operator-supplied HTML through this contract. If rich legal formatting is needed later, introduce an explicitly reviewed and sanitized representation rather than weakening the text-only boundary.

## Failure handling and observability

Network errors, non-2xx responses, malformed payloads and invalid dates all leave the viewer in a retryable error state. The backend continues serving the bundled documents when the optional effective-date configuration is absent. Invalid date configuration produces a `LegalService` warning suitable for deployment diagnostics without personal data.

There is no mutation, background job, persistence retry, pagination, or concurrency surface in this feature.

## Verification

Relevant automated coverage includes:

- backend `LegalService` tests for both documents, configuration overrides and malformed-date fallback;
- backend HTTP integration tests for canonical paths, aliases, route precedence, cache headers and sanitised 404 behaviour;
- frontend `LegalService` tests for successful requests, HTTP failures and malformed/unbounded payload rejection;
- active `LegalDocumentViewerComponent` tests for headings, deep links, semantic dates, empty-state behaviour, semantic theme tokens and text-only rendering;
- dynamic legal page tests for loading, success, failure and retry behaviour;
- Angular router tests proving that canonical route data and `/legal/:type` parameters bind to the shared page and render the requested document.

Repository CI remains authoritative for formatting, lint, unit tests, production builds, accessibility/design governance and dependency review.

## Rollout

No database migration is required. Deploy the backend first or together with the frontend. Existing canonical backend responses remain unchanged, while the alias paths are additive, so mixed-version deployment is safe. If an effective date changes, set the corresponding environment variable before or with the backend release.

## Rollback

Revert the application commits. No stored user data or database schema needs restoration. The cache-control header may be reverted independently if operational policy requires it; any already cached response expires within the documented cache window. Do not replace the client validation or text-only rendering boundary with raw HTML as part of rollback.
