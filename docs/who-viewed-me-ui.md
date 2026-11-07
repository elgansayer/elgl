# Who Viewed Me UI contract

This document describes the production boundary for the two Angular surfaces that show profile visitors. Both read the same endpoint through the same service, so the VIP gate has one owner.

| Surface | Component | Route or location | Rows |
| --- | --- | --- | --- |
| Full visitor log | `ProfileVisitorsComponent` | `/profile/me/visitors` (`/visitors` and `/profile/visitors` redirect here) | Paginated, 20 per page |
| Profile panel | `ProfileComponent` | "Show visitors" toggle on the owner's profile | Latest 5 |

Both call `ProfileVisitsService.getMyVisitors(limit, offset)`, which calls `GET /profile-visits/my-visitors`. Nothing else in the frontend reads visitor identities.

## Product behaviour

- The authenticated `GET /profile-visits/my-visitors` endpoint is authoritative for whether identities are visible (`identity_visible`) and for each row (`is_blurred`). The browser never derives entitlement from cached profile data.
- **Free tier, full page:** one blurred masked card per visit sits under a single upgrade overlay (`8 UKP / $10 USD per month`, "See Plans" navigates to `/subscription`). No visitor link, name, avatar or identifier is rendered.
- **Free tier, profile panel:** each visit is a blurred card with its visit time and a visible "VIP only" label, followed by one line of explanation and a "See Plans" link to `/subscription`.
- **VIP:** names and avatars are shown. On the full page each row links to the visitor's profile.
- Both surfaces have distinct loading, empty, error with retry and populated states. The full page adds bounded "Load more" pagination; the server caps a page at 50 rows and orders newest first.
- If the owner's entitlement changes between pages (for example VIP lapsing), the full page discards rows loaded under the previous state instead of mixing them, so an identity never survives into a masked list and a masked card never receives a profile link.

## Privacy and untrusted response handling

CSS blur is presentation only and is never the privacy boundary.

`ProfileVisitsService.getMyVisitors()` passes every response through `normaliseProfileVisitorsPage()` before any component sees it:

- **Fail closed.** Identities are kept only when the page says `identity_visible: true` and no row is flagged `is_blurred`. Otherwise every row is replaced by an opaque masked entry (`hidden-vip-only`), discarding names, avatar URLs, visitor IDs, biography text and language metadata that a faulty response might contain. Masked rows need only `id` and `created_at`, so a future server that omits the `visitor` object for masked rows keeps working.
- **Bounded and validated.** At most 50 rows are read. Rows without a usable `id` or a parseable `created_at` are dropped, strings are trimmed and length-limited, and language lists are capped.
- **Avatar URLs.** Only absolute HTTP(S) URLs without embedded credentials are accepted. Malformed, `data:`, `javascript:` and credential-bearing URLs fall back to the initial-letter tile.
- **Cursor safety.** A repeated, backwards or malformed `next_offset` is replaced by the next contiguous window, so "Load more" cannot loop on one page.
- **Unusable payloads are errors.** A response that is not a visitor page throws, so the UI shows its error and retry state rather than a misleading "No visitors yet."
- **Compatibility shim.** The singular `native_language` field is accepted next to `native_languages` and exposed as `native_languages: string[]`. Remove it once no supported deployment returns the singular shape.

`ProfileComponent` adds a second line of defence: it maps each visit to a presentation card where a masked card has no identity fields at all, so a later template change cannot render a name or avatar for a visitor the server withheld.

Clients must not render `display_name` for masked rows. The API currently sends a generic English string in that field; the frontend ignores it and uses translated copy.

No visitor identity, profile content, entitlement, token or raw provider error is logged, added to analytics or shown by this UI. Provider failures show the translated `common.error_generic` message, never the error text.

## HTTP privacy and abuse boundary

- Visit recording and visitor-log reads are protected by `SupabaseAuthGuard` and bounded to 30 requests per minute per throttler identity.
- `GET /profile-visits/my-visitors` returns `Cache-Control: private, no-store`, so visitor identity data is not retained by shared or browser HTTP caches.
- The collection is intentionally bounded (`limit` 1 to 50) rather than exposing an unbounded profile-history scan.

## Accessibility

- **Full page:** the section is labelled by its heading; loading is a polite status region; failure is an alert with a keyboard-operable Retry button; the blurred placeholders are `aria-hidden` while the upgrade prompt sits outside that region and stays readable; "Load more" is disabled and `aria-busy` while loading.
- **Profile panel:** the toggle exposes `aria-expanded` and `aria-controls`, and its visible text is its accessible name (it previously carried a static "Hide" `aria-label` in both states). The panel is labelled by its heading and is `aria-busy` while loading. For a masked card the blurred shapes are `aria-hidden`; a screen-reader-only "Hidden visitor" label, the visible time and the visible "VIP only" text carry the meaning, so state is not communicated by blur or colour alone.
- **Themes and layout:** both surfaces use Relay semantic roles (`surface`, `text`, `vip`, `danger-ink`) so cards and text are legible in light and dark themes. The routed page previously referenced undefined CSS variables with dark-theme hex fallbacks, which left names and card backgrounds almost invisible in the light theme. Spinners honour `prefers-reduced-motion` and spacing uses logical properties. The full page's controls use the touch size; the profile panel's compact Retry and plans link use the small size (28px high, above the WCAG 2.2 24px minimum target).

## Internationalisation

All copy resolves through `TranslatePipe`. The keys `profile.visitorsTitle`, `profile.visitorsLink`, `profile.visitorsHide`, `profile.anonymousVisitor` and `events.load_more` were previously undefined, so the UI printed the raw key. They are now in the base dictionary, and `i18n.service.spec.ts` asserts that every key these surfaces render is defined.

## Consolidation

Earlier work left a second, unreachable implementation of this feature. It has been removed so there is one canonical path:

- `VisitorLogsComponent`, its model, styles and specs: `/visitors` was redirected to the canonical page during the information-architecture consolidation and nothing routed to it afterwards. Its payload hardening now lives in the shared service.
- The Angular CLI scaffold (`visitor-logs.ts` rendering "visitor-logs works!") that reused the `app-visitor-logs` selector.
- `UserService.getMyVisitors()`, typed as a plain array although the endpoint returns a page. It made the profile panel throw `visits.slice is not a function` and display that message.
- `UserService.getProfileVisitors()` and `MOCK_VISITORS`, which substituted fabricated visitor identities whenever the legacy request failed.

## Verification

Automated coverage checks:

- free and VIP rendering on both surfaces, including per-card blurred placeholders, hidden-from-assistive-technology regions and the upgrade path;
- masked identity removal from the service result, component state and DOM, including a payload that wrongly still carries identity;
- fail-closed behaviour for `identity_visible: false`, for any `is_blurred` row in a visible page and for entitlement changes between pages;
- avatar URL rejection, malformed and oversized collections, cursor loop prevention and non-page payloads;
- loading, empty, error, retry and load-more failure states;
- toggle semantics and labels on the profile panel;
- dictionary coverage for every key these surfaces render;
- authenticated, throttled and `no-store` backend routes, and newest-first, 50-row bounded collections.

Repository CI remains authoritative for the full Angular unit, static-analysis, build and UI-governance suites.

Browser E2E coverage for the visitor flow is not included. The authenticated fixture exists (`cy.visitWithSession` in `frontend/cypress/support/commands.ts`), but the Cypress support file fails any spec on an unexpected console error or a 401/500 response, and the Cypress binary was not available where this change was authored, so a spec could not be executed. An unexecuted spec against that guard would be a guess. Add one for `/profile/me/visitors` (free page, VIP page, retry after failure) where the binary is available, stubbing `GET **/api/profile-visits/my-visitors*` and the shell requests used by `chat-flow.cy.ts`.

## Rollout and rollback

This is a frontend-only change. It needs no schema migration, API deployment ordering or data backfill and is safe with current and older profile-visit response shapes.

Rollback is a normal application revert. Do not reintroduce a cacheable visitor-log response, a synthetic identity fallback, or rendering of identity fields from masked rows as part of a rollback; the server-side masking contract remains the privacy boundary regardless of UI version.

Known follow-ups outside this change:

- the backend sends an English `display_name` for masked rows; it should omit the field or use a translation key;
- `UserService.recordVisit()` duplicates `ProfileVisitsService.recordVisit()`;
- `backend/src/users/profile-visits.*` and `ProfileVisitsInterceptor` are unregistered legacy code and should be deleted;
- the profile panel specimen still needs Claude Design reconciliation (see the `screen.profile` manifest item);
- the only link to the full log is the person icon in the Moments feed header (`/profile/visitors`), whose accessible name is "Profile"; the profile panel should link to `/profile/me/visitors` and that icon should be relabelled.
