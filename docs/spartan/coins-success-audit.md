# Coins success Spartan/Relay audit

Tracks issue #6051 for `frontend/src/app/components/coins-success` and records the interaction conversion completed by #6052.

## Current surface

`CoinsSuccessComponent` is a standalone Angular checkout-return surface. It has one interactive navigation action, three asynchronous presentation states, one incoming query-parameter contract, and one outgoing route. It does not contain menus, dialogs, forms, custom focus management, drag/drop, popovers or other bespoke interaction widgets.

### Controls, states and utilities

| Surface             | Current implementation                                                             | Behaviour/state                                                             | Spartan/Relay mapping                                                         | Action                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Dashboard action    | Native `<a>` with `routerLink="/dashboard"`, `hlmBtn`, and `size="touch"`          | Navigates to `/dashboard`                                                   | Native link semantics + Angular RouterLink + Spartan Helm button presentation | Keep. Navigation semantics are native while Spartan owns the visual/focus treatment.    |
| Pending state       | `status()` signal value `pending`                                                  | Displayed while the checkout session is being confirmed                     | Relay typography/status presentation                                          | Keep feature state in the component/store boundary; no Brain primitive is required.     |
| Confirmed state     | `status()` signal value `confirmed`                                                | Shows success illustration/title/message after server confirmation succeeds | Relay typography/status presentation                                          | Keep. This is content/state, not an interaction primitive.                              |
| Failed state        | `status()` signal value `failed`                                                   | Used when `session_id` is absent or purchase confirmation returns false     | Relay typography/status presentation                                          | Keep. Preserve the failure path during later visual work.                               |
| Status message      | Semantic `<p role="status" aria-live="polite">`                                    | Announces pending/confirmed/failed copy                                     | Native status semantics + Relay typography tokens                             | Keep. No custom live-region primitive is necessary.                                     |
| Status illustration | Decorative emoji selected from component state with `aria-hidden="true"`           | `🎉` for pending/confirmed, `😕` for failed                                 | None                                                                          | Keep decorative. Do not introduce a primitive solely for the glyph.                     |
| Page layout         | Tailwind layout using `bg-surface-500`, `text-text-primary`, `text-text-secondary` | Full-height centered checkout-return page                                   | Relay semantic surface/text tokens                                            | Keep as presentation; later token/parity work can refine it without changing behaviour. |

## Interaction ownership

There is exactly one actionable element: the Dashboard navigation link. It is a semantic native anchor enhanced by Angular RouterLink and Spartan Helm. Feature code no longer owns a click handler or injects `Router` merely to perform a fixed navigation.

This keeps the correct semantic distinction between a command and navigation:

- native link behaviour owns activation and link semantics;
- `RouterLink` owns client-side Angular navigation;
- `hlmBtn` owns the shared Spartan interaction/focus presentation;
- `size="touch"` preserves the repository touch-target convention;
- the component owns only the fixed destination contract.

No hand-rolled keyboard handlers, pointer-only handlers, focus traps, custom disabled-state shims, roving focus, menus, selects, dialogs or overlays remain to migrate.

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

The Dashboard action is a native anchor with `routerLink="/dashboard"`. No route parameters, query parameters or navigation state are supplied. The destination is unchanged from the previous imperative `Router.navigate(['/dashboard'])` implementation.

Both contracts must remain unchanged unless a separate product/payment-routing change explicitly modifies them.

## Analytics and side effects

The component itself does not emit an analytics/telemetry event. Its meaningful side effect is delegated to `EconomyStore.confirmCoinPurchase(sessionId)` during initialization. The Dashboard action performs navigation only and must not trigger confirmation, balance mutation, or toast side effects.

## Accessibility and internationalisation

- All user-visible copy is translated through `TranslatePipe`.
- The status paragraph uses `role="status"` and `aria-live="polite"` so asynchronous confirmation changes can be announced without stealing focus.
- The emoji illustration is hidden from assistive technology because the translated status copy conveys the result.
- The only interactive element is a semantic native link enhanced by Spartan, with no synthetic `role` or `tabindex` required.
- The current template contains no physical left/right spacing, border or positioning utilities, so it does not introduce an RTL direction dependency.
- Text/background colours use Relay semantic tokens rather than literal product colour values.
- The layout is mobile-first and scales text/illustration sizes at the `sm` breakpoint.

## Migration risks

1. **Do not replace the native link with a clickable container or command button.** A fixed route destination is navigation and should retain native link semantics.
2. **Do not reintroduce an imperative Router click handler.** `RouterLink` already owns this fixed navigation path and removes duplicate feature-level interaction behaviour.
3. **Preserve `size="touch"`.** Removing it can create target-size regressions.
4. **Preserve the pending state while the store confirms the checkout session.** A visual rewrite must not flash a false success state before server confirmation finishes.
5. **Preserve the missing-session and failed-confirmation paths.** A migration that renders only the success case would mask payment failures.
6. **Keep payment confirmation in `EconomyStore`.** Presentation primitives must not own checkout verification, receipt construction, balance mutation or toast side effects.
7. **Preserve the `session_id` input and `/dashboard` output route contracts.** Routing changes belong in a separate product change.
8. **Do not hardcode colours while restyling.** Continue using Relay semantic surface/text tokens so light/dark themes and future token changes remain first-class.
9. **Do not remove the live status semantics without an accessibility review.** The content changes asynchronously after an external checkout redirect.

## Verification

Focused regression coverage verifies the checkout state transition and the Dashboard action's native-link contract, including the exact `/dashboard` destination, touch sizing, absence of synthetic role/tabindex, and keyboard focusability.

Run:

```bash
cd frontend
npm test -- --include='src/app/components/coins-success/coins-success.component.spec.ts'
npm run lint:check
npm run build
```

If the Angular test runner in the current workspace does not support `--include`, run `npm test` instead.

## Audit result

**Interaction conversion complete for #6052.** The checkout state machine remains feature/store-owned, while the only user action now composes native anchor semantics, Angular RouterLink, and the approved Spartan Helm button treatment without a duplicate imperative navigation handler.
