# Coins cancel Spartan/Relay audit

Tracks issue #6046 for `frontend/src/app/components/coins-cancel`; interaction ownership was updated by #6047 and Relay token/theme parity by #6048.

## Current surface

`CoinsCancelComponent` is a standalone Angular component with one interactive navigation control and no overlays, forms, menus, dialogs, async state or local persistence.

### Controls and states

| Surface              | Current implementation                                                                                                          | Behaviour/state                                         | Spartan/Relay mapping                                                                         | Action                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Back link            | Native `<a>` with `hlmBtn`, `size="touch"`, `routerLink="/dashboard"`, and mobile-first width                                   | Navigates to `/dashboard` on activation                 | Native Angular navigation composed with Spartan Helm button presentation (`HlmButtonImports`) | Keep. Native link semantics own navigation while Spartan owns the interaction presentation.         |
| Status illustration  | Decorative `😕` text with `aria-hidden="true"`                                                                                  | Non-interactive                                         | None                                                                                          | Keep as decorative content. Do not introduce a primitive solely for the glyph.                      |
| Status content       | Heading and translated explanatory text inside a labelled `main` landmark                                                       | Static cancellation state                               | Relay typography and text tokens                                                              | Keep. No interactive Brain primitive is needed.                                                     |
| Page and result card | Relay canvas `bg-surface-500` with a semantic `bg-surface-200`, `border-surface-100`, `rounded-card`, `shadow-card` result card | Centred mobile-first card with wider breakpoint spacing | Relay surface, radius, elevation and responsive roles                                         | Keep. #6048 aligned this surface with the same checkout-result hierarchy used by the success state. |

## Interaction inventory

There is exactly one actionable element: the Back link. It is rendered as a native anchor through Angular `RouterLink` and composed with Spartan's Helm button presentation layer. There are no hand-rolled keyboard handlers, click-to-navigate methods, focus traps, pointer-only handlers, disabled-state shims, custom roving focus, menus, popovers, dialogs or selects to migrate.

The native anchor preserves standard link focus and Enter activation semantics. It does not need a synthetic `role="button"`, `tabindex`, or a feature-owned click handler. `size="touch"` preserves the repository's touch-target convention while `hlmBtn` provides the approved Spartan presentation.

## Route contract

Activating the Back link follows `routerLink="/dashboard"`. The migration preserves the exact `/dashboard` destination while delegating navigation semantics to Angular RouterLink and the native anchor.

No route parameters, query parameters or navigation state are currently passed.

## Analytics and side effects

No analytics hook, telemetry event, API request, mutation, storage write or payment-side effect is performed by this component. The cancellation state is informational only. A future migration must not invent a cancellation mutation here because payment cancellation has already occurred before this route is displayed.

## Relay visual contract

Issue #6048 establishes the cancellation result as the non-live counterpart of the checkout success result:

- `bg-surface-500` remains the page canvas.
- The result is elevated onto `bg-surface-200` with `border-surface-100`, `rounded-card`, and `shadow-card` rather than ad hoc palette, radius or elevation values.
- Heading and explanatory copy continue to use `text-text-primary` and `text-text-secondary`.
- The Spartan action inherits the user's configured primary accent through Helm. No feature-owned product colour is applied.
- Mobile uses `px-4 py-6` on the page, `px-5 py-8` on the card, and a full-width action. `sm` and `lg` refinements increase breathing room and return the action to intrinsic width.
- The same semantic tokens are used in light and dark themes. There is no dark-only utility or hard-coded colour path.

## Accessibility and internationalisation

- All user-visible strings are translated through `TranslatePipe`.
- The emoji is hidden from assistive technology because it is decorative.
- The page exposes a named `main` landmark tied to the translated title and message.
- The only interactive element is a semantic native link enhanced by Spartan presentation.
- The link remains keyboard-focusable without synthetic roles or tab stops.
- Current utility classes contain no left/right directional spacing or borders, so the surface is RTL-safe.
- Text, canvas, border, card, radius and elevation use Relay semantic roles rather than hard-coded product colours.
- The layout is mobile-first, remains width-bounded at `max-w-md`, and adds deliberate `sm`/`lg` spacing refinements rather than stretching the mobile composition.
- The mobile action is full-width and keeps Spartan's `touch` size; wider layouts use intrinsic action width.

## Migration risks

1. **Do not replace the native link with a clickable container or command button.** This action is navigation, so link semantics are the correct browser contract.
2. **Do not add direct Spartan Brain usage when the Helm button wrapper already owns the presentation.** Feature code should consume the approved presentation primitive.
3. **Preserve the touch-size contract.** Dropping `size="touch"` can create target-size regressions.
4. **Preserve the `/dashboard` route contract.** Any future navigation change belongs in a separate product-routing issue.
5. **Do not hard-code colours, radii or shadows while restyling.** Continue using Relay semantic roles so light/dark themes, forced colours and future token changes remain first-class.
6. **Do not add synthetic keyboard handlers, `role="button"`, or `tabindex` to the link.** Native anchor behaviour is authoritative.
7. **Do not add a live region to this static state.** The cancellation page is already present when navigated to and should be read as normal document content.
8. **Keep checkout-result visual hierarchy consistent.** Cancellation and success may differ in status content, but their page/card spacing and semantic surface ownership should not drift independently without a product-design reason.

## Prerequisites and follow-on work

Program dependency #5462 is complete. Issue #6047 removed the remaining feature-owned imperative navigation by composing native `RouterLink` semantics with the existing Spartan Helm button presentation. Issue #6048 then aligned the surface with Relay card, border, radius, elevation and responsive roles while preserving that interaction contract.

No new Relay or Spartan primitive is required by this surface.

## Verification

For changes to this surface, run the focused component test and the frontend verification gate:

```bash
cd frontend
npm test -- --include='src/app/components/coins-cancel/coins-cancel.component.spec.ts'
npm run lint:check
npm run build
```

If the Angular test runner in the current workspace does not support `--include`, run `npm test` instead.

The mapped Relay + Spartan component-system preview must continue representing cancellation in both light/mobile and dark/wider states when this visual contract changes.

## Audit result

**Mapped, converted for interaction ownership, and aligned to Relay visual tokens.** The single action uses native navigation semantics plus approved Spartan Helm presentation, while the page and result card use theme-aware Relay surface, border, radius, elevation and responsive roles.
