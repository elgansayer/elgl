# Cultural tip accessibility verification (#6089)

## Scope

This pass verifies the converted `CulturalTipComponent` after the Spartan/Relay audit and theme conversion. The component remains a read-only informational region; there are no controls, overlays, gestures, mutations, analytics hooks, or focus targets to migrate to a Spartan Brain primitive.

The runtime implementation already satisfies the issue's accessibility contract, so this change deliberately locks that behavior with focused regression tests instead of introducing unnecessary interaction or visual changes.

## Verified contract

### Keyboard and input methods

- The cultural tip is exposed as a named `role="region"` and is not itself focusable.
- The rendered surface contains no links, buttons, form fields, `tabindex`, or synthetic `role="button"` elements.
- There is no pointer-only click handler, cursor affordance, or gesture dependency.
- Text remains selectable; `select-none` is not applied.
- Touch users receive the same read-only content as mouse and keyboard users because no action depends on a particular input method.

### RTL and bidirectional layout

- The emphasis edge uses the logical `border-s-4` utility, so it follows the document's start side in both LTR and RTL.
- The component does not force `dir`, allowing host/document direction and browser bidi behavior to remain authoritative.
- No physical left/right border, radius, margin, or padding utilities are used by the callout.
- There are no directional icons or ordered controls that need mirroring.

### Zoom, reflow, and text sizing

- The component has no fixed inline/block dimensions and no inline sizing styles.
- It does not use `overflow-hidden`, `truncate`, or `whitespace-nowrap`, so browser zoom and user font scaling do not intentionally clip required content.
- Mobile-first padding is retained and widens only at the existing `sm` breakpoint.
- Long guide content remains normal document text rather than being placed in a fixed-height scrolling or clipped region.
- The regression suite includes a long unbroken guide string to prevent future fixed-size/clipping regressions.

### Screen readers and semantics

- The informational landmark keeps a translated accessible name via `aria-label`.
- The visible title remains a semantic `h3`; the guide remains a paragraph.
- The implementation does not use a repeated fixed `id`, avoiding duplicate-ID/`aria-labelledby` collisions when multiple instances exist.
- Loading and missing-guide states remain silent and render no landmark, preserving the existing product contract rather than adding unsolicited live-region announcements.

### Reduced motion

The component has no animation or transition behavior. The regression suite prevents motion classes from being introduced as part of this static informational surface.

## Visual and design-sync impact

This issue does not change the visual contract established by the preceding Relay conversion. No component template or styling is changed, so the existing `frontend/design-preview/components/component-system.html` representation remains authoritative and no design-sync reconciliation is required for this verification-only pass.

## Tests

`frontend/src/app/components/cultural-tip/cultural-tip.component.spec.ts` now explicitly covers:

- accessible named-region semantics;
- absence of focusable/interactive descendants;
- logical-direction styling and absence of physical left/right utilities;
- high-zoom/reflow-safe sizing and clipping behavior;
- absence of pointer-only, text-selection-blocking, and motion behavior;
- existing Relay tokens, null/error behavior, and language-driven refetch behavior.

The frontend verification gate remains the authoritative CI validation for the branch.

## Security and privacy

No API, authentication, persistence, logging, telemetry, or user-data boundary changes are introduced. Cultural guide text continues to be fetched through the existing service and rendered as Angular text interpolation.

## Rollout and rollback

There is no runtime rollout or migration. The change is regression coverage plus documentation. Rollback is a normal revert of the test/documentation commits; no production state requires restoration.
