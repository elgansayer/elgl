# Daily learning tip Relay token and responsive completion

Issue: #6093  
Target: `frontend/src/app/components/daily-learning-tip`

## Outcome

The Daily Learning Tip surface already satisfies the Relay token ownership required by #6093 on current `main`, so this stage deliberately does not churn production markup or introduce a second visual abstraction.

The component composes the shared Relay `AppCardComponent` with its default variant. That primitive owns the semantic surface contract:

- `rounded-card`;
- `bg-surface-200`;
- `border-surface-100`;
- `shadow-card`; and
- logical `ps` / `pe` padding.

Feature copy uses `text-text-muted` for the heading/loading hierarchy and `text-text-primary` for the resolved or fallback tip. There are no feature-owned hexadecimal colours, dark-only foregrounds/backgrounds, fixed widths, or physical left/right spacing classes.

## Responsive contract

The surface is intentionally host-sized rather than feature-sized. The card is a block with no fixed width or height, so the same semantic hierarchy reflows at the 390px mobile baseline, tablet widths and desktop widths without a feature breakpoint or duplicated layout.

The dedicated design preview records:

- light theme at the 390px mobile baseline; and
- dark theme at tablet/desktop width.

This is intentional: responsive parity does not require inventing breakpoint-specific styling when the component has no layout transition to own.

## Theme and accent ownership

Daily Learning Tip does not hard-code a primary accent because it has no interactive or accent-bearing control. Light/dark values come from Relay semantic tokens, and the surface therefore follows the active theme without feature-level `dark:` forks.

If the product later adds an action, Spartan/Relay interaction and accent ownership must be reviewed separately rather than being inferred from this read-only card.

## Verification

`daily-learning-tip.relay.spec.ts` locks the design contract by asserting:

- the rendered card carries Relay surface/radius/elevation classes;
- heading and tip text use semantic text roles;
- feature markup contains no hard-coded black/white/hex product colours;
- card sizing remains host-controlled;
- horizontal spacing is logical (`ps` / `pe`) rather than physical; and
- feature classes do not fork light/dark values.

`frontend/design-preview/components/daily-learning-tip.html` represents the required light/mobile and dark/wide states without changing runtime behaviour.

## Scope and rollback

No API, authentication, persistence, navigation, runtime state or visual product behaviour changes in this stage. The authenticated `GET /daily-tip` request and existing loading/success/fallback behaviour remain authoritative.

Rollback is a normal revert of the verification, preview and completion-document commit. No migration or data rollback is required.
