# Moments image lightbox

The shared Angular `LightboxComponent` presents image Moments as a full-screen gallery. The Moments feed owns only the selected image list and initial index; focus management, dismissal and gallery navigation remain inside the shared lightbox.

## User-visible behaviour

- Selecting any image in a multi-image Moment opens the full-screen Spartan dialog at that exact image.
- Touch and pen users can swipe horizontally to move between images. A gesture must travel at least 48 CSS pixels and be predominantly horizontal; short or vertical gestures are ignored.
- Desktop users can use the visible previous/next controls. Keyboard users can use Left/Right Arrow as well as Home/End to jump to the first or last image.
- Navigation is bounded rather than wrapping. Controls that cannot move further are not rendered.
- The current position is shown visually and announced through a polite live region. Indicator buttons expose `aria-current` for the selected image.
- Duplicate image URLs remain independently addressable because gallery rendering is keyed by position rather than URL.
- The initial and direct-navigation indexes are clamped to the available image range, so stale or malformed caller state cannot leave the gallery with no active image.

## Loading and failure behaviour

Each image has explicit loading and unavailable states. An image load failure does not close the gallery and does not prevent navigation to the remaining images. The failed URL is not written to logs or surfaced in an error message.

Image state is held only for the lifetime of the component. Closing and reopening the lightbox naturally retries browser image loading. There is no persisted lightbox state and no background retry loop.

## Accessibility

The component continues to use the shared Spartan dialog primitives for focus trapping, Escape dismissal, focus return and modal semantics. Interactive controls are native buttons with accessible names and visible focus behavior inherited from Spartan.

Only the active image remains exposed to assistive technology; inactive or failed image elements are marked `aria-hidden`. Current gallery position changes are announced in a polite live region. Close, navigation and gallery-indicator controls use Spartan's 44 by 44 CSS pixel touch target. The indicator row can wrap on narrow or highly zoomed viewports.

Image and indicator transitions are removed when the operating system requests reduced motion. This does not change gallery navigation, focus order or live-region announcements.

## Security and privacy

This feature introduces no API, schema, authentication or authorization changes. It displays only media URLs already present on Moments visible to the current user. The lightbox does not log URLs, image contents, account identifiers or gesture coordinates.

Angular remains responsible for sanitizing bound image URLs. Browser image fetching follows the same origin/network behavior as the existing feed thumbnails; the lightbox does not proxy, persist or transform media.

## Verification

From `frontend/`:

```sh
npm test -- --include='src/app/components/lightbox/lightbox.component.spec.ts' --include='src/app/components/moments-feed/moments-lightbox.integration.spec.ts'
npm run lint:check
npm run build
```

Regression coverage includes index clamping, bounded navigation, keyboard navigation, horizontal swipe intent, cancellation and mismatched pointers, mouse/secondary-pointer isolation, load/error state recovery, Moments-to-lightbox wiring, duplicate URLs, touch-target sizing, reduced-motion behavior and accessibility semantics.

## Rollout and rollback

No migration or coordinated backend deployment is required. The frontend can be deployed independently.

Rollback is a normal revert of the lightbox implementation/tests/documentation. Moment records and media objects require no data rollback because this change does not mutate persisted content or API contracts.
