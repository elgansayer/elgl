# Font scale slider Spartan / Relay audit

Issue: #6217 (`Spartan UI 0431`)

Target: `frontend/src/app/components/font-scale-slider`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `FontScaleSliderComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The surface is intentionally small: it renders one native range input, a translated label, and a read-only percentage value. It has no menu, overlay, dialog, popover, route transition, network request, or product analytics hook of its own. Its side effect is global and device-local: user input delegates to `FontScaleService`, which updates the application root font size and persists the selected scale in `localStorage` when storage is available.

The audit covers the component, its existing Vitest suite, `FontScaleService`, and the global shell integration in `AppComponent` / `app.component.html`.

No runtime behavior is changed by this audit. Because there is no visual-contract change, no Claude Design preview update is required in this documentation-only stage.

## Current product contract

`FontScaleSliderComponent` is rendered once in the global application top bar next to the theme selector. It exposes no Angular inputs or outputs. Instead it reads and mutates the singleton `FontScaleService` directly.

The current range contract is:

| Property | Value | Owner |
| --- | ---: | --- |
| Minimum scale | `0.8` / 80% | `FontScaleService.min` |
| Maximum scale | `1.5` / 150% | `FontScaleService.max` |
| Step | `0.05` / 5 percentage points | `FontScaleService.step` |
| Default | `1.0` / 100% | `FontScaleService` |
| Current value | `FontScaleService.scaleFactor` signal | service state |
| Persistence key | `app_font_scale` | `FontScaleService` |
| Presentation | localized percent via `Intl.NumberFormat` | component |

User interaction flows through the following boundary:

```text
native range input
  -> input event
  -> FontScaleSliderComponent.onInput()
  -> Number.parseFloat(input.value)
  -> FontScaleService.setScale(value)
  -> clamp + snap to 0.05 step
  -> scaleFactor signal
  -> service effect updates document.documentElement.style.fontSize
  -> service effect attempts localStorage persistence
  -> component recomputes the localized percentage label
```

The component must remain an adapter around this service contract. Spartan/Relay migration must not duplicate clamping, persistence, document mutation, or scale state in the feature template.

## Complete control and state inventory

There is exactly one interactive element in the target surface.

| Element / state | Current implementation | Current owner | Target owner | Migration action |
| --- | --- | --- | --- | --- |
| Font scale label | Native `<label for="fontScaleSlider">` | Feature presentation / `TranslatePipe` | Relay presentation + native label semantics | Preserve a visible translated label; make the input ID instance-safe if the component can render more than once |
| Slider interaction | Native `<input type="range">` | Browser/native range semantics | Native range, unless an approved Spartan Slider is introduced | Do not reimplement pointer, keyboard, focus, min/max/step, or disabled semantics in feature code |
| Minimum | `[min]="min"` | `FontScaleService` | Service contract | Preserve 0.8 |
| Maximum | `[max]="max"` | `FontScaleService` | Service contract | Preserve 1.5 |
| Step | `[step]="step"` | `FontScaleService` | Service contract | Preserve 0.05 |
| Current value | `[value]="scale()"` | Service signal | Service state | Preserve service as single source of truth |
| Input adaptation | `(input)="onInput($event)"` plus `parseFloat` | Feature adapter | Feature adapter | Keep only type/value adaptation; service owns normalization |
| Numeric ARIA state | Explicit `aria-valuemin/max/now` | Feature template | Native semantics where sufficient | Avoid redundant ARIA unless it adds tested value |
| Spoken value | `aria-valuetext="scalePercentLabel()"` | Feature/i18n | Relay/i18n presentation | Preserve localized percent wording |
| Visible value | Decorative `<span aria-hidden="true">` | Feature presentation | Relay presentation | Preserve if useful visually; it must not duplicate speech output |
| Group wrapper | `<div role="group" aria-label=...>` | Feature template | Native/Relay grouping only if needed | Review redundancy because the slider already has a visible associated label |
| Track/thumb styling | Browser range plus `accent-primary` | Browser + Relay primary token | Native/Relay or approved Slider Helm | Preserve per-user primary accent; avoid hard-coded product colors |
| Width/spacing | `w-24 h-1`, `ps-4`, `gap-2`, percentage `w-8` | Feature layout | Relay responsive composition | Remove fixed-width assumptions if they cause header/high-zoom overflow |
| Label wrapping | `whitespace-nowrap` | Feature layout | Relay responsive composition | Revisit for translation expansion and high zoom |
| Loading state | None | n/a | n/a | Do not invent asynchronous loading state |
| Error state | None in component | n/a | n/a | Storage failures intentionally degrade silently in the service; do not invent false failures |
| Overlay/focus trap | None | n/a | n/a | No Dialog/Popover/Menu primitive is required |

## Global shell integration

The only checked-in consumer is the application top bar:

```html
<app-theme-selector />
<app-font-scale-slider />
```

The top bar is part of `AppComponent`, not the font-scale component. It is a horizontal `flex` row containing the coin balance, purchase link, notifications, guided-tour action, optional biometric action, theme selector, and this slider.

That integration matters for responsive migration. The slider cannot be evaluated only in isolation: at 200%/400% zoom and on a 390 px viewport, its fixed 96 px range, 32 px percentage slot, label, padding, and surrounding controls may contribute to horizontal pressure. The later responsive/accessibility stages must verify the whole top-bar composition without moving unrelated shell behavior into this component.

`AppComponent` also injects `FontScaleService` so the global scale effect is initialized independently of user interaction. Preserve that global initialization behavior if the component is later moved or conditionally rendered.

There is no route contract owned by this component. Scaling applies globally regardless of the current route.

## FontScaleService ownership

`FontScaleService` is the authoritative state/persistence layer and should remain outside Spartan/Relay presentation.

### Scale normalization

`setScale()`:

1. rejects non-finite values;
2. rounds to the nearest configured 0.05 step from the 0.8 minimum;
3. clamps to `[0.8, 1.5]`;
4. rounds the stored factor to two decimals;
5. updates `scaleFactor`.

The UI migration must not add a second, divergent clamping implementation.

### Global application

An Angular `effect()` applies the scale as a root rem base:

```text
baseRem = 16 * scale
html.style.fontSize = `${baseRem}px`
--app-base-font-size = `${baseRem}px`
```

This means the slider is an accessibility control that can materially change every rem-based layout. Conversion testing must therefore include surrounding surfaces and not merely assert the range value.

### Persistence

The service stores the percentage as an integer-like string (`Math.round(scale * 100)`) under `app_font_scale`. Loading accepts both current factor-style values and the historical percentage-style representation. Storage access is guarded with `try/catch`, so private browsing, quota failures, or blocked storage keep in-memory scaling functional.

That compatibility behavior is service-owned and must not move into a UI primitive.

### Related text-size state

The same service also owns `textSizePreference` and `chatTextSize`, but `FontScaleSliderComponent` only manipulates `scaleFactor`. Do not merge global font scale and chat-message text size into one slider contract as part of Spartan conversion.

## Spartan ownership decision

### Spartan Brain

The surface does not need a custom headless state machine.

A native range input already supplies:

- Tab focus;
- Arrow-key adjustment;
- Home/End behavior where supported by the platform;
- pointer and touch dragging;
- min/max/step constraints;
- accessibility mapping;
- platform high-contrast behavior;
- value mutation events.

Repository search found no checked-in `HlmSlider` / `@spartan-ng/helm/slider` usage at the time of this audit. Therefore the implementation ticket must **not** replace the native input with a generic element carrying `role="slider"`, custom pointer handlers, or custom keyboard handling merely to increase Spartan coverage.

If a repository-approved Spartan Slider capability is added later, it may own the reusable slider interaction only if it preserves the existing range semantics and service boundary. Otherwise the native input is the correct behavioral primitive.

### Spartan Helm

There is currently no Helm directive on this control. That is acceptable in the absence of an approved checked-in Slider bridge.

The later conversion stage should first verify package capability and repository ownership rules. If a Helm Slider exists but is not yet exposed through the repository-owned UI boundary, prerequisite primitive work should land before feature code imports lower-level Brain APIs directly.

### Relay

Relay should own the product presentation around the native/Spartan interaction:

- semantic text colors;
- dynamic primary accent treatment;
- focus-visible presentation where native/global focus policy is insufficient;
- responsive width and spacing;
- high-zoom reflow;
- translated label/value layout;
- light/dark theme parity.

The current `accent-primary`, `text-text-secondary`, logical `ps-4`, and `text-end` usage already aligns with important Relay/RTL concepts. Conversion should converge layout/radius/size choices without replacing semantic tokens with literal colors.

## Bespoke utility audit

The component has no SCSS file and no custom JavaScript interaction model. Its bespoke presentation is entirely in template utilities:

- `flex items-center gap-2` for horizontal composition;
- `ps-4` for logical leading padding;
- `text-sm` for the wrapper;
- `whitespace-nowrap` on the visible label;
- `w-24 h-1` on the native range;
- `accent-primary` for the browser slider accent;
- `w-8 text-end` on the percentage readout.

Migration risks are concentrated in the fixed widths and no-wrap label. They are not reasons to introduce a complex primitive; they are Relay responsive-layout concerns.

## Accessibility contract

### Native semantics to preserve

The range input must remain keyboard and pointer operable without feature-owned event emulation. In particular, migration must preserve:

- enabled Tab focus;
- Arrow-key adjustments;
- browser-supported Home/End behavior;
- min/max/step constraints;
- touch dragging;
- visible focus indication;
- the current continuous `input` event behavior.

Do not switch from `input` to `change`: doing so would delay global scaling until interaction completion and change the existing product response.

### Label relationship

The visible label is correctly associated through `for="fontScaleSlider"` / `id="fontScaleSlider"` for the single current instance. The fixed ID becomes unsafe if another instance is rendered in tests, settings, or a responsive shell variant. The implementation stage should use an instance-safe ID while retaining a native label relationship.

The wrapper also has `role="group"` with the same accessible label text. Because there is only one labeled interactive control, this grouping may be redundant and can cause repetitive screen-reader output. The accessibility stage should test actual output and keep the group only if it adds meaningful context.

### Value announcement

`scalePercentLabel()` uses `Intl.NumberFormat(currentLang, { style: 'percent' })`, so `aria-valuetext` and the visible value are locale-aware. Preserve this behavior.

The explicit `aria-valuemin`, `aria-valuemax`, and `aria-valuenow` duplicate semantics already exposed by the native range element. The implementation stage may retain them if regression tests demonstrate a benefit, or remove redundant values if native accessibility output remains correct. Do not replace native semantics with ARIA-only state.

### Touch target

The visible range track is only `h-1`. The browser may expose a larger native hit area than that CSS box, but this must be verified rather than assumed. The later accessibility stage should enforce the repository's touch-target expectations without making the visible track unnecessarily large.

### Motion and reduced motion

The component defines no transitions, animations, or motion effects. Changing the range immediately changes global text size, which is functional state rather than decorative animation. No reduced-motion branch is currently needed.

## RTL and internationalisation

The current component is mostly direction-safe:

- leading padding uses `ps-4` rather than `pl-*`;
- numeric output alignment uses `text-end` rather than `text-right`;
- there are no physical left/right positioning rules;
- the percentage uses the active UI locale.

The later stages still need explicit RTL verification because native range controls may mirror their visual direction under `dir="rtl"`. Do not add custom left/right Arrow logic on top of browser behavior.

`whitespace-nowrap` on the translated label is the main i18n layout risk. Long labels can force a crowded global header or horizontal overflow, especially after the user increases the base font size. The responsive stage should permit wrapping/recomposition rather than truncating translated content.

The visible percentage has a fixed `w-8`; localized percent formatting, non-Latin digits, or 150% at large font scale can exceed that assumption. Use content-aware sizing in the visual stage.

## Responsive, zoom, and self-referential scaling risk

This control changes the root font size that also determines its own rem-based Tailwind dimensions. That makes high-scale behavior self-referential: increasing to 150% makes the control, label, surrounding header, and all sibling rem-based controls larger.

The later conversion/accessibility stages must verify at minimum:

- 390 px mobile viewport at 80%, 100%, and 150% application scale;
- tablet and desktop widths;
- browser 200% and 400% zoom in combination with application scale;
- long translated labels;
- RTL layout;
- the full top-bar integration, not only the isolated component;
- no loss of access to theme, notification, tour, biometric, or purchase controls due to overflow.

A compact responsive representation is acceptable if product design calls for it, but it must retain an accessible name, current value, and full keyboard/touch operation.

## Theme and accent contract

The component uses semantic text tokens and `accent-primary`. The latter is important because `primary` is the per-user accent boundary and must continue to work in both light and dark themes.

Do not replace the range accent with hard-coded hex/rgb values. If a future Relay slider wrapper customizes track/thumb surfaces, all states must use semantic theme roles and preserve adequate contrast in both themes.

Because this audit changes no visual behavior, the existing Claude Design representation does not need to change in this PR. The visual conversion and final regression/design-preview tickets own that work.

## Privacy, security, and data boundaries

The slider does not send its value to the backend and has no analytics hook. The selected scale is local device UI preference data.

Security/privacy rules for migration:

- do not add the font scale to analytics, logs, URL parameters, or API payloads without a separate product/privacy decision;
- do not move the storage key into server-synced profile data as part of UI conversion;
- preserve storage-failure degradation so accessibility does not depend on `localStorage` availability;
- do not use user-provided HTML or unsafe DOM sinks in label/value presentation;
- preserve `Intl.NumberFormat` output as text content.

No privileged data, authentication token, profile content, or cross-user data is involved.

## Analytics and route inventory

No product analytics call is present in `FontScaleSliderComponent` or `FontScaleService` for scale changes.

The component owns no route and performs no navigation. It is rendered by the global shell, so its state applies across all routes. Spartan/Relay migration must not introduce a settings route dependency or make scaling route-scoped.

## Existing regression coverage

`font-scale-slider.component.spec.ts` is active and currently covers:

1. component creation;
2. the documented 80%-150% range and 5% step;
3. initial value rendering;
4. propagation of the 150% maximum to `FontScaleService.setScale()`;
5. updated `aria-valuenow` / localized `aria-valuetext` after scale changes;
6. visible percentage rendering;
7. signal-driven percentage updates;
8. native label-to-input association.

This is a useful baseline, but it does not yet lock all migration risks.

## Required regression coverage for conversion

Before the surface is considered converted, focused tests should cover at least:

1. 80%, 100%, and 150% values;
2. the 5% step and service-owned snapping/clamping boundary;
3. non-numeric input cannot propagate an invalid scale;
4. locale changes recompute the visible and accessible percentage text;
5. native label association remains valid;
6. two instances do not create duplicate IDs;
7. no feature-owned keyboard handler intercepts native range behavior;
8. Arrow/Home/End behavior remains native in browser/E2E verification;
9. touch/pointer interaction has an adequate effective target;
10. RTL uses logical layout and does not add physical-direction key handling;
11. long translations do not force horizontal overflow;
12. localized percentage content is not clipped by a fixed-width slot;
13. light and dark theme states use semantic tokens;
14. per-user primary accent continues to affect the slider;
15. the 390 px top bar remains operable at maximum application scale;
16. browser 200% and 400% zoom preserve the slider and sibling top-bar actions;
17. blocked/quota-limited `localStorage` does not break in-memory scaling;
18. a restored historical percentage-format value still resolves to the intended factor;
19. global root font size and `--app-base-font-size` update after scale changes;
20. chat-specific text-size state remains independent from global scale.

## Migration risks

1. **Replacing a native control without a real primitive need.** A custom generic-element slider would regress platform keyboard, touch, and accessibility semantics.
2. **Direct Brain imports.** If a Spartan Slider becomes available, feature code must consume the repository-approved Helm/Relay boundary rather than bypassing ownership rules.
3. **Duplicate state.** Local component slider state can drift from `FontScaleService.scaleFactor`; keep the service authoritative.
4. **Double normalization.** Re-clamping in both UI and service can produce mismatched step behavior. The service already owns normalization.
5. **Changing event timing.** Replacing continuous `input` with `change` makes scaling feel delayed and changes current behavior.
6. **Fixed-ID collisions.** `fontScaleSlider` is safe only while exactly one instance exists.
7. **Top-bar overflow.** Fixed range/readout widths plus `whitespace-nowrap` are fragile under translation, 150% application scale, and browser zoom.
8. **Self-referential layout growth.** Raising root font size enlarges the control and its container; screenshots at only 100% app scale can miss failures.
9. **Loss of per-user accent.** A replacement slider must not hard-code colors or bypass `primary`.
10. **Storage coupling.** UI migration must not make interaction fail because persistence is unavailable.
11. **Incorrect account semantics.** Current scale is device-local, not a server/account preference; do not silently change that contract.
12. **Conflating global and chat text size.** Both live in one service but are separate product preferences.
13. **Redundant accessibility naming.** The wrapper group and visible native label may cause repeated announcements if preserved without testing.
14. **Design-only fixes masking service regressions.** The visual stage should not modify legacy storage compatibility or root-font application without dedicated tests.

## Prerequisite primitive work

No blocking new primitive is required for the next stage.

Before converting controls, implementation should:

1. re-check the installed Spartan/Helm surface for an approved Slider capability;
2. if none exists, retain the native range and treat native HTML as the approved interaction owner;
3. if a Slider exists, confirm the repository-owned Helm/Relay import path before using it;
4. keep `FontScaleService` outside the UI primitive;
5. coordinate responsive changes with the global top-bar layout rather than introducing a feature-local overflow workaround that hides sibling actions.

The absence of a Spartan Slider is not a blocker. Native `<input type="range">` is preferable to an unapproved custom state machine.

## Recommended implementation sequence

### #6218: controls and interactions

- verify Slider availability;
- retain native semantics if no approved Slider exists;
- make label/input identity instance-safe;
- remove redundant grouping/ARIA only after accessibility verification;
- keep `FontScaleService` authoritative;
- preserve continuous input behavior and localized value text.

### #6219: Relay tokens, responsive layout, and theme parity

- remove fragile fixed-width/no-wrap assumptions;
- preserve semantic text and dynamic primary accent roles;
- verify top-bar composition at 390 px and maximum app scale;
- verify light/dark states without literal product colors.

### #6220: accessibility, RTL, zoom, and input methods

- verify native keyboard semantics rather than emulating them;
- verify touch hit area;
- verify RTL native slider direction;
- test long translations and localized percentages;
- verify 200%/400% zoom plus 150% in-app scaling with all top-bar actions reachable.

### #6221: regression and design preview

- lock interaction, storage-degradation, theme, RTL, responsive, and zoom contracts;
- add explicit light/dark and mobile/wide preview states if the visual contract changed;
- reconcile the design audit/manifest only for the actually shipped representation.

## Audit conclusion

The font-scale surface does **not** need more custom interaction code. Its correct behavioral owner today is the native range control, with `FontScaleService` owning state, normalization, persistence, and global DOM application, and Relay owning presentation.

The substantive migration work is therefore to protect native semantics while making the control instance-safe, translation-safe, theme-consistent, and resilient inside the crowded global top bar at high application scale and browser zoom. No route, API, analytics, or server-side data change is required.