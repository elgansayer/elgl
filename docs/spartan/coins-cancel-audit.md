# Coins cancel Spartan/Relay audit

Tracks issue #6046 for `frontend/src/app/components/coins-cancel`; interaction ownership was updated by #6047.

## Current surface

`CoinsCancelComponent` is a standalone Angular component with one interactive navigation control and no overlays, forms, menus, dialogs, async state or local persistence.

### Controls and states

| Surface | Current implementation | Behaviour/state | Spartan/Relay mapping | Action |
| --- | --- | --- | --- | --- |
| Back link | Native `<a>` with `hlmBtn`, `size="touch"` and `routerLink="/dashboard"` | Navigates to `/dashboard` on activation | Native Angular navigation composed with Spartan Helm button presentation (`HlmButtonImports`) | Keep. Native link semantics own navigation while Spartan owns the interaction presentation. |
| Status illustration | Decorative `😕` text with `aria-hidden="true"` | Non-interactive | None | Keep as decorative content. Do not introduce a primitive solely for the glyph. |
| Status content | Heading and translated explanatory text inside a labelled `main` landmark | Static cancellation state | Relay typography and surface tokens | Keep. No interactive Brain primitive is needed. |
| Page layout | Tailwind layout using `bg-surface-500`, `text-text-primary`, `text-text-secondary` | Responsive centered card-width content | Relay design tokens | Keep. No bespoke interaction exists here. |

## Interaction inventory

There is exactly one actionable element: the Back link. It is rendered as a native anchor through Angular `RouterLink` and composed with Spartan's Helm button presentation layer. There are no hand-rolled keyboard handlers, click-to-navigate methods, focus traps, pointer-only handlers, disabled-state shims, custom roving focus, menus, popovers, dialogs or selects to migrate.

The native anchor preserves standard link focus and Enter activation semantics. It does not need a synthetic `role="button"`, `tabindex`, or a feature-owned click handler. `size="touch"` preserves the repository's touch-target convention while `hlmBtn` provides the approved Spartan presentation.

## Route contract

Activating the Back link follows `routerLink="/dashboard"`. The migration preserves the exact `/dashboard` destination while delegating navigation semantics to Angular RouterLink and the native anchor.

No route parameters, query parameters or navigation state are currently passed.

## Analytics and side effects

No analytics hook, telemetry event, API request, mutation, storage write or payment-side effect is performed by this component. The cancellation state is informational only. A future migration must not invent a cancellation mutation here because payment cancellation has already occurred before this route is displayed.

## Accessibility and internationalisation

- All user-visible strings are translated through `TranslatePipe`.
- The emoji is hidden from assistive technology because it is decorative.
- The page exposes a named `main` landmark tied to the translated title and message.
- The only interactive element is a semantic native link enhanced by Spartan presentation.
- The link remains keyboard-focusable without synthetic roles or tab stops.
- Current utility classes contain no left/right directional spacing or borders, so the surface is RTL-safe.
- Text and background use Relay semantic tokens rather than hardcoded product colours.
- The layout is mobile-first (`px-4`) and scales heading/illustration sizes at the `sm` breakpoint.

## Migration risks

1. **Do not replace the native link with a clickable container or command button.** This action is navigation, so link semantics are the correct browser contract.
2. **Do not add direct Spartan Brain usage when the Helm button wrapper already owns the presentation.** Feature code should consume the approved presentation primitive.
3. **Preserve the touch-size contract.** Dropping `size="touch"` can create target-size regressions.
4. **Preserve the `/dashboard` route contract.** Any future navigation change belongs in a separate product-routing issue.
5. **Do not hardcode colours while restyling.** Continue using Relay surface/text tokens so light/dark themes and future token changes remain first-class.
6. **Do not add synthetic keyboard handlers, `role="button"`, or `tabindex` to the link.** Native anchor behaviour is authoritative.

## Prerequisites and follow-on work

Program dependency #5462 is complete. Issue #6047 removed the remaining feature-owned imperative navigation by composing native `RouterLink` semantics with the existing Spartan Helm button presentation. Later token, accessibility and regression tickets can focus on visual parity and validation rather than replacing this interaction again.

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

**Mapped and converted for interaction ownership.** The single action uses native navigation semantics plus the approved Spartan Helm presentation, with no feature-level click-to-navigate behaviour remaining.
