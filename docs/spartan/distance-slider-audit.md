# Distance slider Spartan / Relay audit

Issue: #6143 (`Spartan UI 0361`)

Target: `frontend/src/app/components/distance-slider`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `DistanceSliderComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The component is a small, reusable discovery filter with one native range input. It has no overlay, menu, dialog, popover, navigation, storage, API call or analytics side effect of its own. Its product meaning comes from `DiscoveryComponent`, which uses the emitted distance to schedule a partner search and converts kilometres to metres for the discovery API.

The current control already relies on the browser's native range-input interaction model. The migration should therefore avoid replacing native keyboard, pointer and accessibility behaviour with a feature-owned state machine merely to increase Spartan usage. If an approved Spartan slider capability is available when the conversion ticket is implemented, it may own the reusable slider interaction; otherwise the native range input remains the correct behavioural primitive and Relay should own its product presentation.

## Current component contract

`DistanceSliderComponent` exposes four inputs and one output:

| Contract            |     Default | Meaning                                                        |
| ------------------- | ----------: | -------------------------------------------------------------- |
| `minKm`             |         `1` | Minimum allowed distance in kilometres                         |
| `maxKm`             |       `200` | Maximum allowed distance in kilometres                         |
| `initialDistanceKm` | `undefined` | Parent-provided starting/current distance                      |
| `disabled`          |     `false` | Disables the native range input                                |
| `distanceChanged`   |         n/a | Emits a clamped kilometre value for user-driven `input` events |

Internal `currentDistanceKm` starts at 50 km. An Angular `effect()` copies `initialDistanceKm` into that signal whenever the input changes. The effect does **not** emit `distanceChanged`; only `onChange()` emits.

That distinction is important. Parent-to-child synchronisation must not accidentally trigger a new discovery request. User-driven movement emits; external state synchronisation only updates the rendered value.

The native range has `step="1"` and clamps user-driven values into `[minKm, maxKm]` before emitting.

## Complete control and state inventory

| Element / state            | Current implementation                                                   | Current owner                          | Target owner                                          | Migration action                                                                        |
| -------------------------- | ------------------------------------------------------------------------ | -------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Distance label             | Native `<label for="distance-range-slider">` with translated radius text | Feature presentation / `TranslatePipe` | Relay presentation                                    | Preserve the label relationship; make the ID instance-safe                              |
| Slider interaction         | Native `<input type="range">`                                            | Browser/native range semantics         | Native range or an approved Spartan Slider capability | Do not recreate keyboard/pointer behaviour in feature code                              |
| Minimum value              | `[min]="minKm()"`                                                        | Component input                        | Feature contract                                      | Preserve                                                                                |
| Maximum value              | `[max]="maxKm()"`                                                        | Component input                        | Feature contract                                      | Preserve                                                                                |
| Current value              | `[value]="currentDistanceKm()"`                                          | Component signal                       | Feature state                                         | Preserve single source of truth                                                         |
| Step size                  | `step="1"`                                                               | Native input                           | Native/primitive                                      | Preserve unless product requirements change                                             |
| Disabled state             | `[disabled]="disabled()"` plus opacity/cursor utilities                  | Native input plus Relay presentation   | Native/primitive semantics plus Relay styling         | Preserve native `disabled`; avoid `aria-disabled` shims                                 |
| User input                 | `(input)="onChange($event)"`                                             | Component feature logic                | Feature value adaptation                              | Keep only clamping/output adaptation; primitive owns interaction                        |
| Output                     | `distanceChanged.emit(clamped)`                                          | Component                              | Feature contract                                      | Preserve kilometre payload                                                              |
| ARIA numeric state         | `aria-valuemin`, `aria-valuemax`, `aria-valuenow`                        | Feature template                       | Native range semantics already expose these values    | Prefer native semantics; only add ARIA where it improves the accessible contract        |
| Accessible value text      | Hard-coded `"{{ currentDistanceKm() }} km"`                              | Feature template                       | Translation/localisation layer                        | Replace hard-coded unit wording with translation-safe/localised text                    |
| Track                      | Custom WebKit/Firefox pseudo-element CSS                                 | Feature CSS                            | Relay presentation / approved slider Helm             | Replace bespoke/off-contract token usage                                                |
| Thumb                      | Custom WebKit/Firefox pseudo-element CSS                                 | Feature CSS                            | Relay presentation / approved slider Helm             | Preserve product accent while using valid Relay tokens                                  |
| Accent colour              | `[style.accent-color]="'var(--color-primary)'"`                          | Relay primary token                    | Relay                                                 | Preserve per-user/theme primary behaviour if the selected implementation still needs it |
| Empty/loading/error states | None                                                                     | n/a                                    | n/a                                                   | Do not invent async states in this child                                                |
| Overlay/focus trap         | None                                                                     | n/a                                    | n/a                                                   | No Dialog/Popover/Menu primitive is required                                            |

There is exactly one interactive element in this component.

## Parent integration and route contract

The only checked-in use of this component is inside `DiscoveryComponent` on the lazy `/discovery` route.

The parent binds:

```html
<app-distance-slider
  (distanceChanged)="onDistanceChanged($event)"
  [initialDistanceKm]="selectedDistanceKm()"
  [disabled]="!isVip()"
></app-distance-slider>
```

A separate sibling `/vip` link is rendered by the parent when the current user is not VIP. The distance slider itself must not absorb upgrade navigation or VIP entitlement policy. Its responsibility is only to expose a disabled numeric control when asked.

`DiscoveryComponent.onDistanceChanged()` ignores unchanged values, updates `selectedDistanceKm`, and schedules a debounced search. When the search runs, the parent sends:

```text
radius_metres = selectedDistanceKm * 1000
```

to `DiscoveryService.findPartners()`.

The slider therefore has no direct API contract. Its integration contract is:

```text
user changes native range
  -> DistanceSliderComponent clamps kilometre value
  -> distanceChanged(km)
  -> DiscoveryComponent updates selectedDistanceKm
  -> debounced discovery search
  -> radius_metres = km * 1000
```

Primitive migration must preserve this boundary. Do not move discovery requests, debouncing, VIP checks or kilometre-to-metre conversion into the slider.

## Behaviour and side effects

The child has no analytics hook, network request, router action, persistent storage or global state mutation.

The only side effect is emitting a number to its parent in response to a native `input` event. Because `input` fires continuously while the range thumb moves, the parent intentionally owns debouncing. Changing the component to emit only on `change` would alter product responsiveness and should not happen as part of a primitive migration without a dedicated product decision.

Likewise, the `effect()` that accepts `initialDistanceKm` currently updates local state without emitting. Preserve that one-way synchronisation unless a separate API redesign explicitly changes it.

## Spartan ownership decision

### Spartan Brain

No dialog, menu, combobox, checkbox, radio group, toggle group or other complex headless state machine is present.

The range control is already a semantic HTML control with browser-owned:

- keyboard increment/decrement behaviour;
- pointer/touch dragging;
- disabled semantics;
- focusability;
- min/max/step semantics;
- platform accessibility mapping.

Do not replace those behaviours with custom key handlers, pointer capture code, `role="slider"` on a generic element, or feature-level focus management.

Before the conversion ticket, verify whether the repository's installed/approved Spartan version exposes a Slider capability. No checked-in `HlmSlider` or `@spartan-ng/helm/slider` usage is present at the time of this audit, so this audit does not assume one is available.

If an approved Spartan Slider exists, wrap it behind the same small feature contract and keep discovery orchestration outside it. If no approved Slider exists, retaining `<input type="range">` is preferable to inventing a parallel primitive.

### Spartan Helm

There is currently no Helm directive on the range input. That is acceptable while there is no approved checked-in Slider bridge.

A future Helm migration must not be treated as permission to change:

- kilometre units;
- min/max defaults;
- one-kilometre step;
- continuous `input` emission;
- VIP disabled behaviour;
- parent-owned debouncing.

### Relay

Relay should own the visual contract around the control:

- text hierarchy for the radius label;
- track surface colour;
- primary-accent thumb/fill treatment;
- disabled presentation;
- theme parity;
- responsive width and spacing;
- any product-level wrapper introduced for reusable numeric sliders.

The component should consume semantic tokens rather than raw product colours or ad-hoc CSS variables.

## Relay token audit

The template itself uses `text-text-secondary` and the primary accent. Those are aligned with the current semantic token system.

The custom pseudo-element CSS has a concrete token defect that must be fixed by the visual-conversion stage:

```css
background: var(--color-surface-100);
border: 2px solid var(--color-surface);
```

The repository's Relay theme source defines surface colour data through variables such as `--surface-100-rgb` and maps them through Tailwind utilities. A repository search found no other definition or usage establishing `--color-surface-100` as a supported application token, and `--color-surface` is likewise not the canonical surface contract used by the main theme.

That means the browser can drop those declarations when the custom properties are unresolved. The intended track surface and thumb border may therefore be transparent or browser-dependent today.

The implementation stage should use the repository's canonical Relay utilities/variables or an approved Slider Helm implementation rather than creating fallback literals. Do **not** repair this with hard-coded hex/rgb values.

`--color-primary` is explicitly defined by the current theme and is also the user-accent boundary, so primary-accent behaviour must remain dynamic across light/dark themes and per-user primary customisation.

## Accessibility and keyboard contract

### Native semantics to preserve

The input is already keyboard-focusable and supports browser/platform range controls. The migration must preserve:

- Tab navigation to the control when enabled;
- exclusion from ordinary focus navigation when disabled according to native browser behaviour;
- Arrow key changes;
- Home/End behaviour where supported by the platform;
- min/max/step constraints;
- pointer and touch dragging;
- visible `:focus-visible` treatment from the application's global focus policy.

No feature-owned `keydown` handler is required.

### Label relationship and multi-instance safety

The current component uses the fixed ID `distance-range-slider` and a matching `for` attribute. This works for one instance but is unsafe when more than one slider is rendered on a page: duplicate IDs make the label relationship ambiguous.

The migration should generate an instance-safe ID or use another Angular-supported labelling relationship while preserving a visible translated label. Do not remove the visible label merely because the range has native semantics.

### Accessible value text

The template currently provides:

```text
aria-valuetext="<number> km"
```

`km` is hard-coded user-facing unit text. The component's visible label already uses `discovery.radiusLabel` through `TranslatePipe`, so the accessible value must use a translation-safe/localisation-aware contract as well.

The implementation should avoid English-only abbreviations in ARIA attributes and should keep the spoken value consistent with the visible radius wording. If the native numeric value plus visible label is sufficient after testing, redundant ARIA may be removed rather than duplicated.

### Target size

The input box is currently `h-8` and the custom thumb is 22 px. The later accessibility stage should explicitly verify the effective pointer target against the repository's touch-target requirements at 390 px and high zoom. Increasing only the visible thumb is not sufficient if the actual interactive hit area remains too small.

### Disabled state

Use native `disabled`; do not simulate the VIP-disabled state through CSS opacity alone. The current code correctly sets the native property and only uses opacity/cursor utilities as presentation.

The parent-owned `/vip` link remains the actionable upgrade path, so disabling the slider must not make the overall feature impossible to discover.

## RTL and internationalisation

The component has no left/right margin or padding utilities and no physical-positioned labels, so its surrounding layout is already direction-safe.

The range interaction itself needs explicit browser verification under `dir="rtl"`. Native range controls may mirror their direction according to document direction; a migration must not layer custom left/right keyboard semantics on top of that behaviour.

Requirements for the implementation stage:

- preserve logical layout and native direction behaviour;
- test LTR and RTL thumb movement rather than assuming identical physical direction;
- keep the visible label translated through `TranslatePipe`;
- localise accessible value wording instead of hard-coding `km`;
- allow long translated labels to wrap when necessary instead of clipping them with fixed width;
- preserve numeric readability at 200% and 400% zoom.

The current label uses `whitespace-nowrap`. That is safe for the short present copy but is a translation-expansion risk. The responsive/theme ticket should confirm whether nowrap is genuinely required; do not allow a long localisation to force horizontal overflow at 390 px or high zoom.

## Responsive and zoom contract

The component is width-fluid (`w-full`) and contains no fixed page width. Its parent currently places it in a flex row beside the VIP note and changes the age/distance section from a column to a row at the `md` breakpoint.

The slider itself should continue to:

- fit a 390 px mobile viewport without horizontal scrolling;
- expand into available tablet/desktop width rather than using a hard-coded pixel width;
- preserve label readability under text expansion;
- keep the thumb and track operable at 200% and 400% zoom;
- remain usable when the parent renders the adjacent VIP link;
- avoid absolute positioning tied to LTR geometry.

There is no overlay or viewport-anchored content to migrate.

## State and validation risks

### Initial value is not clamped

User-driven values are clamped in `onChange()`, but `initialDistanceKm` is copied directly into `currentDistanceKm` by the effect.

If a parent supplies an initial value outside a custom `[minKm, maxKm]` range, component state and the native control's rendered/clamped behaviour can disagree. Dynamic changes to min/max can create the same mismatch.

The implementation stage should define and test a single invariant:

```text
minKm <= currentDistanceKm <= maxKm
```

without emitting a user-change event merely because parent inputs were normalised.

### Invalid bounds

There is no explicit policy for `minKm > maxKm`. Do not silently create a new product policy in the visual conversion. The implementation should either normalise/guard invalid bounds in a documented way or make the contract explicit through tests.

### Parent updates versus user updates

The effect and `onChange()` write the same signal from different directions. A future controlled-component refactor must prevent feedback loops:

```text
parent value -> child display
```

must remain distinguishable from:

```text
user input -> child output -> parent value
```

## Existing test coverage

`distance-slider.component.spec.ts` exists but the entire suite is currently disabled with `describe.skip`.

The skipped tests attempt to cover:

- component creation;
- initial value synchronisation;
- default 50 km state;
- emitted values;
- high/low clamping;
- disabled/enabled state;
- translated label rendering.

One skipped expectation is inconsistent with the current implementation: the test subscribes to `distanceChanged`, changes `initialDistanceKm`, and expects an emission. The production component does not emit from the synchronising effect. The conversion stage must resolve that mismatch deliberately; it should not unskip the suite by changing product behaviour just to satisfy the stale expectation.

## Required regression coverage for conversion

Before the surface is considered converted, focused tests should cover at least:

1. default min/max/value/step semantics;
2. parent-provided initial value renders without a synthetic `distanceChanged` emission;
3. user input emits the clamped kilometre value;
4. values above `maxKm` clamp correctly;
5. values below `minKm` clamp correctly;
6. dynamic min/max changes maintain the chosen invariant;
7. disabled input uses the native disabled property;
8. enabled input remains natively focusable;
9. the visible label is associated with the correct input;
10. two component instances do not create duplicate IDs;
11. accessible value wording is translation-safe;
12. keyboard Arrow/Home/End behaviour is not intercepted by feature code;
13. RTL does not introduce physical-direction utility regressions;
14. 390 px layout does not overflow with the parent VIP note;
15. 200% and 400% zoom preserve the required content and control;
16. light and dark themes resolve track/thumb/border tokens;
17. per-user primary accent continues to affect the accent treatment;
18. parent integration still debounces a changed distance and sends `km * 1000` as `radius_metres`.

The component test should be re-enabled only after stale expectations are corrected to the intended contract.

## Migration risks

1. **Reimplementing a native slider with generic elements.** This would create unnecessary keyboard, focus, pointer and accessibility debt.
2. **Assuming a Spartan Slider exists.** Verify the installed/approved capability first; no checked-in `HlmSlider` usage exists today.
3. **Keeping unresolved custom CSS variables.** The current `--color-surface-100` / `--color-surface` pseudo-element declarations are not the canonical Relay token contract and may be dropped by the browser.
4. **Hard-coding fallback colours.** Fix token ownership, not symptoms.
5. **Breaking per-user accent behaviour.** Primary styling must continue to come from the dynamic Relay primary boundary.
6. **Emitting on parent synchronisation.** This can cause unexpected discovery searches and controlled-component feedback loops.
7. **Changing from `input` to `change`.** That alters when discovery filtering responds to thumb movement.
8. **Moving debounce into the child.** Debounce belongs to discovery orchestration because the slider has no knowledge of search policy.
9. **Duplicating VIP policy.** The parent owns entitlement and upgrade navigation.
10. **Duplicate static IDs.** Multi-instance rendering can break label association.
11. **English-only ARIA value text.** `km` must not remain hard-coded in a product accessibility contract.
12. **Ignoring input-bound changes.** Parent-supplied or dynamic values can currently fall outside the component's own min/max state invariant.
13. **Treating the skipped spec as authoritative.** At least one expectation contradicts current production semantics and must be corrected intentionally.
14. **Shrinking the effective touch target while restyling.** Visual thumb size and actual interactive hit area both require verification.

## Prerequisites and implementation sequence

Program dependency #5462 is complete.

Recommended sequence for follow-on tickets:

1. confirm whether the repository's installed Spartan version has an approved Slider Brain/Helm capability;
2. decide native-range versus approved Spartan Slider ownership without changing the public feature contract;
3. make labelling instance-safe and translation-safe;
4. define/clamp the controlled-value invariant without emitting synthetic user changes;
5. replace unresolved pseudo-element token references with canonical Relay presentation or approved Helm styling;
6. preserve the parent's VIP, debounce and API boundaries;
7. correct and re-enable the focused component suite;
8. add multi-instance, keyboard, RTL, theme/accent and high-zoom regression coverage;
9. update the mapped Relay + Spartan design preview only when a later ticket changes the visual contract.

No new Dialog, Popover, Menu, Select, Checkbox or button primitive is required by this surface.

## Verification guidance

For implementation changes to this component, run the focused component test and the normal frontend verification gate:

```bash
cd frontend
npm test -- --include='src/app/components/distance-slider/distance-slider.component.spec.ts'
npm run lint:check
npm run build
```

If the current Angular/Vitest runner does not support the focused `--include` form, run the repository's normal frontend test command instead.

For this audit-only stage, source inspection covers:

- `distance-slider.component.ts`;
- `distance-slider.component.spec.ts`;
- the parent `DiscoveryComponent` template and distance-change/search mapping;
- the lazy `/discovery` route;
- Relay theme variables in `frontend/src/styles.scss`;
- the repository Spartan/Relay architecture and engineering guidance.

No runtime, route, API, schema or visual contract is changed by this audit document.

## Audit result

**Mapped, with implementation prerequisites identified.** The component has one native range interaction and should remain browser-owned unless an approved Spartan Slider capability is verified. The main follow-on risks are unresolved custom surface-token variables, fixed-ID labelling, hard-coded accessible unit text, unclamped parent-synchronised values, and a fully skipped regression suite whose emission expectation does not match current production behaviour.
