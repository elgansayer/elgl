# Coins success Spartan/Relay audit

Tracks issue #6051 for `frontend/src/app/components/coins-success`.

## Current surface

`CoinsSuccessComponent` is a standalone Angular checkout-return surface. It has one interactive control, three asynchronous presentation states, one incoming query-parameter contract, and one outgoing route. It does not contain menus, dialogs, forms, custom focus management, drag/drop, popovers or other bespoke interaction widgets.

### Controls, states and utilities

| Surface | Current implementation | Behaviour/state | Spartan/Relay mapping | Action |
| --- | --- | --- | --- | --- |
| Dashboard button | Native `<button>` with `hlmBtn`, `type="button"`, `size="touch"` via `HlmButtonImports` | Navigates to `/dashboard` | Spartan Helm button | Keep. The only user interaction is already owned by the approved Spartan button primitive. |
| Pending state | `status()` signal value `pending` | Displayed while the checkout session is being confirmed | Relay typography/status presentation | Keep feature state in the component/store boundary; no Brain primitive is required. |
| Confirmed state | `status()` signal value `confirmed` | Shows success illustration/title/message after server confirmation succeeds | Relay typography/status presentation | Keep. This is content/state, not an interaction primitive. |
| Failed state | `status()` signal value `failed` | Used when `session_id` is absent or purchase confirmation returns false | Relay typography/status presentation | Keep. Preserve the failure path during later visual work. |
| Status message | Semantic `<p role="status" aria-live="polite">` | Announces pending/confirmed/failed copy | Native status semantics + Relay typography tokens | Keep. No custom live-region primitive is necessary. |
| Status illustration | Decorative emoji selected from component state with `aria-hidden="true"` | `🎉` for pending/confirmed, `😕` for failed | None | Keep decorative. Do not introduce a primitive solely for the glyph. |
| Page layout | Tailwind layout using `bg-surface-500`, `text-text-primary`, `text-text-secondary` | Full-height centered checkout-return page | Relay semantic surface/text tokens | Keep as presentation; later token/parity work can refine it without changing behaviour. |

## Interaction inventory

There is exactly one actionable element: the Dashboard button. It is already a semantic native button enhanced by Spartan Helm. There are no hand-rolled keyboard handlers, pointer-only handlers, focus traps, custom disabled-state shims, roving focus, menus, selects, dialogs or overlays to migrate.

The button keeps native Enter/Space activation semantics, uses `type="button"` to avoid accidental submission if this surface is ever embedded inside a form, and uses the repository's `size="touch"` convention for a touch-friendly target.

## State and checkout contract

The component starts in `pending`, then asynchronously reads `ActivatedRoute.queryParams`:

1. If `session_id` is missing, the component transitions directly to `failed` and does not attempt purchase confirmation.
2. If `session_id` is present, it calls `EconomyStore.confirmCoinPurchase(sessionId)`.
3. A truthy confirmation result transitions to `confirmed`; a false result transitions to `failed`.

The store owns the payment-confirmation side effect. It posts the checkout receipt token to the economy API, updates the in-memory/offline coin balance on success, and emits success/error feedback. The UI migration must not duplicate or move that payment logic into a presentation primitive.

## Route contracts

### Incoming

The route expects the checkout provider to return a `session_id` query parameter. Its absence is intentionally treated as a failed confirmation state.

### Outgoing

Activating the Dashboard button calls `Router.navigate(['/dashboard'])`. No route parameters, query parameters or navigation state are supplied.

Both contracts must remain unchanged unless a separate product/payment-routing change explicitly modifies them.

## Analytics and side effects

The component itself does not emit an analytics/telemetry event. Its meaningful side effect is delegated to `EconomyStore.confirmCoinPurchase(sessionId)` during initialization. Later Spartan/Relay conversion work must preserve the single store-owned confirmation path and must not trigger confirmation from the Dashboard button or from repeated presentation events.

The Dashboard button performs navigation only.

## Accessibility and internationalisation

- All user-visible copy is translated through `TranslatePipe`.
- The status paragraph uses `role="status"` and `aria-live="polite"` so asynchronous confirmation changes can be announced without stealing focus.
- The emoji illustration is hidden from assistive technology because the translated status copy conveys the result.
- The only interactive element is a semantic native button enhanced by Spartan.
- The current template contains no physical left/right spacing, border or positioning utilities, so it does not introduce an RTL direction dependency.
- Text/background colours use Relay semantic tokens rather than literal product colour values.
- The layout is mobile-first and scales text/illustration sizes at the `sm` breakpoint.

## Migration risks

1. **Do not replace the native button with a clickable container.** That would regress keyboard, focus and assistive-technology semantics.
2. **Do not add direct Spartan Brain behaviour when the Helm button already owns the interaction.** The current action needs no new feature-level interaction abstraction.
3. **Preserve `type="button"` and `size="touch"`.** Removing either can create submission or target-size regressions.
4. **Preserve the pending state while the store confirms the checkout session.** A visual rewrite must not flash a false success state before server confirmation finishes.
5. **Preserve the missing-session and failed-confirmation paths.** A migration that renders only the success case would mask payment failures.
6. **Keep payment confirmation in `EconomyStore`.** Presentation primitives must not own checkout verification, receipt construction, balance mutation or toast side effects.
7. **Preserve the `session_id` input and `/dashboard` output route contracts.** Routing changes belong in a separate product change.
8. **Do not hardcode colours while restyling.** Continue using Relay semantic surface/text tokens so light/dark themes and future token changes remain first-class.
9. **Do not remove the live status semantics without an accessibility review.** The content changes asynchronously after an external checkout redirect.

## Prerequisites and follow-on work

Program dependency #5462 is complete. The single user control is already on Spartan Helm, so issue #6052 should not replace it with another interaction implementation merely to satisfy the conversion program.

No new Relay or Spartan Brain primitive is required for the current interaction model. Follow-on work can focus on token/theme parity, accessibility verification and regression/design-preview coverage while preserving the checkout state machine documented here.

## Verification

The existing focused component spec covers component creation, logical-direction utility safety and the confirmed-state transition. For changes to this surface, run the focused component test and frontend verification gate:

```bash
cd frontend
npm test -- --include='src/app/components/coins-success/coins-success.component.spec.ts'
npm run lint:check
npm run build
```

If the Angular test runner in the current workspace does not support `--include`, run `npm test` instead.

## Audit result

**Mapped and ready for the remaining migration stages.** Every current control, presentation state and bespoke utility in `coins-success` has been inventoried. The only interactive control already uses the approved Spartan Helm button primitive; the checkout confirmation remains correctly separated in `EconomyStore`, and no additional Brain primitive is required by this surface.
