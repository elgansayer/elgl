# Product empty-state illustrations

Issue: #1071

## Scope

ELGL ships three custom vector illustrations for the product empty states that previously referenced missing files:

- `frontend/public/assets/illustrations/no-messages.svg` for the empty Chat list.
- `frontend/public/assets/illustrations/no-moments.svg` for the empty Moments feed.
- `frontend/public/assets/illustrations/no-users-nearby.svg` for Discovery when the current filters return no partners.

The existing `AppEmptyStateComponent` remains the single presentation primitive. No competing empty-state component or interaction pattern is introduced.

## Visual language

The illustrations use a shared 240 by 160 view box, rounded geometry and a restrained warm/cool accent pairing. They are intentionally simple at the rendered 192 px width so they remain clear on mobile, high zoom and high-density displays. Each image has a transparent background and enough mid-tone structure to remain visible on both light and dark Relay surfaces.

The artwork colours are illustration-only values, not semantic UI state. Controls, copy, borders, surfaces and focus treatment continue to come from Relay and Spartan tokens, including the user's configured primary accent where applicable. No meaning is communicated by illustration colour alone.

The three concepts are distinct:

- **No Messages:** overlapping conversation bubbles with response dots.
- **No Moments Found:** a small stack of empty post/photo cards.
- **No Users Nearby:** a radar/search field with a central learner and outlying location markers.

No words are embedded in the SVGs, so localisation remains owned by the translated empty-state title, description and action.

## Accessibility

The artwork is decorative. The shared empty-state primitive wraps illustration media in `aria-hidden="true"` and renders it with `alt=""`. The visible translated title names the empty-state region, so assistive technology receives the same product state without redundant image narration.

SVG roots also declare `aria-hidden="true"` and `focusable="false"` as defence in depth. The assets contain no animation, interactive regions or focus targets. Removing or failing to load an illustration does not remove the title, explanation or action.

## Security and privacy

The SVGs are checked-in static assets. They contain no scripts, event handlers, `foreignObject`, raster payloads, external URLs, embedded data URLs, animation or user content. Rendering them performs no application API call and sends no account, location, chat or Moment data.

The repository verification contract in `scripts/verify-empty-state-illustrations.mjs` checks these constraints and verifies that all three product templates still reference the corresponding public assets.

## Performance

Each asset is capped at 12 kB by the verifier and is served through Angular's existing `public` asset pipeline. `AppEmptyStateComponent` keeps its existing lazy image loading, responsive width and maximum-inline-size constraints. No JavaScript is required to render the illustrations.

## Failure behaviour

Illustration loading is non-critical. The translated empty-state copy and action remain functional if an asset request fails. No retry loop or telemetry containing user data is added for decorative media failures.

The verifier fails CI if an asset is deleted, its product reference is removed, unsafe SVG capabilities are introduced, the responsive view box changes unexpectedly, or the shared decorative accessibility contract regresses.

## Verification

Run:

```bash
npm run check:empty-state-illustrations
```

The root `npm run verify` command also runs this contract alongside the existing frontend build, tests, accessibility/design governance and repository checks.

Manual review should cover the three empty states at narrow/mobile and desktop widths in both light and dark app themes, including 200 percent browser zoom. The illustration must never replace or obscure the translated title, description or primary action.

## Rollout and rollback

This is a static frontend asset change with no API, authentication, database, migration or persisted-state dependency. It can ship with the normal frontend deployment.

Rollback is a normal revert. If application templates still reference these paths after rollback, retain the files or revert those references in the same deployment to avoid decorative 404 requests. No data cleanup is required.
