# Gift animation overlay: Spartan / Relay audit

Issue: #6242
Target: `frontend/src/app/components/gift-animation-overlay`

## Purpose

This audit maps the Gift Animation Overlay to the current Relay + Spartan authority before further migration work. The surface is a transient, non-modal notification layer with one dismiss action. It is not a dialog and must not acquire dialog focus trapping, modal blocking, or route ownership merely to satisfy a component-system migration.

## Source reviewed

- `frontend/src/app/components/gift-animation-overlay/gift-animation-overlay.component.ts`
- `frontend/src/app/components/gift-animation-overlay/gift-animation-overlay.component.spec.ts`
- `frontend/src/app/services/gift-animation.service.ts`
- `frontend/src/app/services/translate.pipe.ts`
- `frontend/src/styles.scss`
- `design-sync.manifest.json`
- `DESIGN.md`
- `docs/spartan-relay-architecture.md`

## Current behaviour and state map

The component observes `GiftAnimationService.currentAnimation()` and renders only while an animation exists. The service owns visibility, queueing and dismissal; the component owns presentation and Lottie lifecycle.

| Surface / state                  | Current owner                    | Design-system authority           | Migration rule                                                              |
| -------------------------------- | -------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| Full viewport notification layer | Feature composition              | Relay layout/tokens               | Keep non-modal and pointer-transparent except real controls.                |
| Screen-dimming visual layer      | Feature composition              | Relay semantic surface tokens     | Replace physical black with a semantic surface/scrim role.                  |
| Lottie animation                 | Feature + `lottie-web`           | Feature media                     | Keep decorative and `aria-hidden`; honour global reduced-motion policy.     |
| Gift icon                        | Feature content                  | Feature                           | Preserve as visible content; do not add focus behaviour.                    |
| Broadcast title                  | Feature + i18n                   | Relay typography + app i18n       | Preserve localised title and content hierarchy.                             |
| Broadcast description            | Feature + i18n                   | Relay typography + app i18n       | Preserve localised sender/receiver/gift/cost announcement.                  |
| Gift banner                      | Feature composition              | Relay visual tokens               | Remove off-token colour and timing values.                                  |
| Dismiss action                   | Spartan Helm `HlmButton`         | Spartan Helm + Relay presentation | Keep the owned button primitive; add an explicit localised accessible name. |
| Visible state                    | `GiftAnimationService.isVisible` | Feature state                     | Preserve fade-out behaviour without moving state into the button primitive. |
| Queue / next gift                | `GiftAnimationService`           | Feature state                     | Do not move queue policy into Relay or Spartan.                             |
| Lottie destroy/reload            | Component lifecycle              | Feature media                     | Preserve cleanup on replacement and destroy.                                |

No current interactive element is omitted from this mapping. The dismiss button is the only user-operable control.

## Spartan ownership decision

### Brain

No new Spartan Brain primitive is required. The overlay does not implement a modal dialog, menu, combobox, tooltip, popover, selection model, or focus-managed composite. Introducing a dialog Brain primitive would incorrectly make a transient notification modal and would change pointer/focus behaviour.

### Helm

The dismiss action already uses `HlmButton`. That is the correct interaction owner. Follow-up implementation should preserve `type="button"`, keyboard activation and the repository-wide focus-visible contract, while giving the icon-only control a meaningful localised accessible name.

### Relay

Relay owns the visual contract around the Helm control and notification content:

- semantic surface/text/fill colour roles;
- shared motion duration/easing roles;
- responsive spacing and radii;
- light/dark theme parity;
- per-user primary accent behaviour;
- RTL-neutral symmetric layout;
- reduced-motion behaviour through the global accessibility boundary.

## Current design-system drift

The current component still contains visual values outside the Relay contract:

- `bg-black/30` for the dimming layer;
- `to-neon-orange` in the gift gradient;
- `bg-white/20`, `text-white` and `hover:bg-white/30` on the dismiss control;
- literal `600ms` and `400ms` component-local motion timings.

Those values should be migrated under #6244 to Relay semantic surfaces/fills and shared `--app-motion-*` / `--app-ease-standard` roles. The existing `vip`, `accent`, `primary`, `text-on-fill`, `surface-*` and related Relay-backed Tailwind roles should be preferred over introducing a new celebration palette.

Because `design-sync.manifest.json` maps `frontend/src/app/components` to `spartan.component-system`, any implementation that changes this visual contract must update the mapped component-system design preview or manifest evidence in the same change.

## Accessibility contract

The notification currently uses `role="alert"` with `aria-live="polite"` and a translated broadcast description. Follow-up work must preserve a single concise announcement and avoid exposing decorative Lottie content to assistive technology.

The dismiss button currently has only the visible `✕` glyph. The implementation migration should give it an explicit translated name such as the app-owned common close/dismiss string; a glyph alone is not a sufficient product-level accessible label.

The overlay is intentionally non-modal. Do not:

- focus the overlay container automatically;
- trap focus;
- add `aria-modal="true"`;
- block unrelated page controls with pointer capture;
- add Escape handling unless product behaviour explicitly requires it and the ownership contract is updated.

The actual dismiss button must remain reachable by keyboard and keep the global Relay/Spartan `:focus-visible` ring.

## Reduced motion

The repository already has a global `prefers-reduced-motion: reduce` boundary. The component must not bypass it with competing animation declarations. Lottie is script-driven rather than CSS-driven, so implementation-stage verification should explicitly confirm whether decorative Lottie playback also needs suppression when the user requests reduced motion; CSS duration collapse alone does not necessarily stop the player.

Any Lottie suppression must preserve the textual gift announcement and dismiss action.

## RTL and responsive behaviour

The current centred layout is direction-neutral and uses symmetric horizontal spacing. Follow-up work must retain logical/symmetric layout and avoid physical left/right positioning.

Verification targets:

- 390px mobile viewport;
- tablet;
- desktop;
- 400% zoom/reflow;
- RTL document direction;
- long translated sender, receiver and gift names.

The banner must wrap without clipping and remain within the viewport. The dismiss control must remain independently pointer-operable while the decorative full-screen layer stays pointer-transparent.

## Theme and colour contract

Light and dark themes are independently authored through Relay CSS variables. Follow-up work must use semantic token-backed utilities rather than literal black/white or legacy celebration colours. `text-on-fill` must remain paired only with a fill whose contrast has been designed for that role.

The gift treatment may retain celebratory emphasis, but it should be composed from existing Relay `vip`, `accent`, `primary`, semantic surface and on-fill roles rather than defining another colour system.

## Analytics, routes and side effects

The component has no router dependency, URL mutation, navigation action, form submission or analytics hook. The only user action delegates to `GiftAnimationService.dismiss()`.

The component side effects are limited to Lottie lifecycle management:

1. load animation data for the current `GiftAnimationType`;
2. destroy a prior animation before replacement;
3. destroy the player when the component is destroyed or no animation remains.

Migration work must not add routing, persistence, analytics, network calls or queue policy to this component.

## Existing test coverage

The current spec verifies:

- creation and no-active-animation state;
- active Lottie container rendering;
- gift icon/banner rendering;
- alert/live-region attributes;
- each supported Lottie animation type;
- dismiss delegation;
- fade-out state;
- zoom animation class;
- switching to another animation.

Implementation-stage gaps to close:

- explicit accessible name on the dismiss button;
- `type="button"` and Spartan button ownership assertion;
- absence of literal black/white/off-token celebration classes after migration;
- light/dark semantic-token use rather than screenshot-only colour assumptions;
- reduced-motion handling for script-driven Lottie if needed;
- long-content / narrow-viewport contract where practical.

## Migration risks

### Accidental modalisation

Using a dialog primitive solely because the component is called an overlay would change its product semantics. Keep it a non-modal live notification unless requirements change.

### Duplicate interaction ownership

Do not add custom keyboard/focus logic around the already-owned Helm button.

### Off-token visual preservation

Visual equivalence is not a reason to preserve literal black, white or `neon-orange`; translate the celebration treatment into Relay roles and update the design preview evidence.

### Reduced-motion gap

Global CSS suppression may not stop `lottie-web`. Verify the actual script-driven path instead of assuming the CSS contract covers it.

### Announcement duplication

Do not create nested live regions or announce the same gift through both decorative media and textual state.

## Recommended implementation sequence

1. Keep `HlmButton` as the sole dismiss interaction primitive.
2. Add a translated accessible name and explicit button type.
3. Replace literal/off-token colours with Relay semantic roles.
4. Replace component-local timing constants with Relay motion roles.
5. Verify script-driven Lottie behaviour under reduced motion and suppress only decorative playback if necessary.
6. Update the mapped `spartan.component-system` design-preview evidence for any visual-contract change.
7. Extend the component tests for accessibility, token ownership and reduced motion.
8. Run frontend lint/unit/build plus Spartan boundary, component-system, design-sync and RTL/reduced-motion gates.

## Exit criteria for #6242

This audit maps every current control, state, overlay and side effect, identifies the correct Spartan/Relay owner, records the absence of route/analytics contracts, and identifies the concrete prerequisite work for #6243 and #6244. No runtime behaviour is intentionally changed by this audit itself.
