# Coins cancel Spartan/Relay audit

Tracks issue #6046 for `frontend/src/app/components/coins-cancel`.

## Current surface

`CoinsCancelComponent` is a standalone Angular component with one interactive control and no overlays, forms, menus, dialogs, async state or local persistence.

### Controls and states

| Surface | Current implementation | Behaviour/state | Spartan/Relay mapping | Action |
| --- | --- | --- | --- | --- |
| Back button | Native `<button>` with `hlmBtn`, `type="button"`, `size="touch"` | Navigates to `/dashboard` on activation | Spartan Helm button (`HlmButtonImports`) | Keep. The interaction is already owned by the approved Spartan button primitive. |
| Status illustration | Decorative `😕` text with `aria-hidden="true"` | Non-interactive | None | Keep as decorative content. Do not introduce a primitive solely for the glyph. |
| Status content | Heading and translated explanatory text inside a named `main` landmark | Static cancellation state | Relay typography and surface tokens | Keep. No interactive Brain primitive is needed. |
| Page layout | Tailwind layout using `bg-surface-500`, `text-text-primary`, `text-text-secondary` | Responsive centered card-width content | Relay design tokens | Keep. No bespoke interaction exists here. |

## Interaction inventory

There is exactly one actionable element: the Back button. It is already rendered through Spartan's Helm button presentation layer. There are no hand-rolled keyboard handlers, focus traps, pointer-only handlers, disabled-state shims, custom roving focus, menus, popovers, dialogs or selects to migrate.

The native button preserves Enter/Space activation and focus semantics. `type="button"` prevents accidental form submission if the component is embedded in a form in the future. `size="touch"` preserves the repository's touch-target convention.

## Route contract

Activating the Back button calls `Router.navigate(['/dashboard'])`. The migration must preserve this exact destination unless product routing changes in a separate issue.

No route parameters, query parameters or navigation state are currently passed.

## Analytics and side effects

No analytics hook, telemetry event, API request, mutation, storage write or payment-side effect is performed by this component. The cancellation state is informational only. A future migration must not invent a cancellation mutation here because payment cancellation has already occurred before this route is displayed.

## Accessibility and internationalisation

- All user-visible strings are translated through `TranslatePipe`.
- The emoji is hidden from assistive technology because it is decorative.
- The status copy is exposed through the named `main` landmark without an unnecessary static live region.
- The only interactive element is a semantic native button enhanced by Spartan.
- Current utility classes contain no left/right directional spacing or borders, so the surface is RTL-safe.
- Text and background use Relay semantic tokens rather than hardcoded product colours.
- The layout is mobile-first (`px-4`) and scales heading/illustration sizes at the `sm` breakpoint.

## Migration risks

1. **Do not replace the native button with a clickable container.** That would regress keyboard and assistive-technology semantics.
2. **Do not add direct Spartan Brain usage when the Helm button wrapper already owns the interaction.** Feature code should consume the approved presentation primitive.
3. **Preserve `type="button"` and the touch-size contract.** Dropping either can create submission or target-size regressions.
4. **Preserve the `/dashboard` route contract.** Converting to a different navigation mechanism is acceptable only if behaviour remains equivalent.
5. **Do not hardcode colours while restyling.** Continue using Relay surface/text tokens so light/dark themes and future token changes remain first-class.
6. **Keep static feedback semantics static.** Do not add a live region unless the content begins changing after initial render.

## Prerequisites and follow-on work

Program dependency #5462 is complete. The control itself is already on Spartan Helm, so issue #6047 should treat this audit as evidence that no additional Brain primitive is required for the current interaction. Later token, accessibility and regression tickets can focus on visual parity and validation rather than replacing the button again.

No new Relay primitive is required by this surface.

## Verification

For changes to this surface, run the focused component test and the frontend verification gate:

```bash
cd frontend
npm test -- --include='src/app/components/coins-cancel/coins-cancel.component.spec.ts'
npm run lint:check
npm run build
```

If the Angular test runner in the current workspace does not support `--include`, run `npm test` instead.

## Audit result

**Mapped and ready for the remaining migration stages.** Every control, state, overlay and bespoke utility in `coins-cancel` has been inventoried. The single interactive control is already on the approved Spartan button primitive; no duplicate feature-level interaction behaviour remains to replace.

## Regression and design-preview lock

Issue #6050 locks the documented behaviour and visual intent without changing product behaviour:

- The component spec provides an explicit router test harness and verifies that activating the Back action navigates exactly to `/dashboard`.
- Existing tests continue to cover the named landmark, decorative illustration, keyboard focusability, touch sizing, fluid high-zoom layout and logical-direction safety.
- `frontend/design-preview/components/component-system.html` contains explicit light/mobile and dark/desktop references for the cancellation state, including the Helm-owned Back action.
- The preview uses system/semantic colour roles and logical sizing so it remains valid in forced-colour and RTL review contexts.

The interaction-conversion stage (#6047) requires no additional runtime primitive because the Back action already uses `hlmBtn`. The separate Relay token/theme parity stage (#6048) remains independently tracked, so this audit does not mark that visual-polish work complete prematurely.
