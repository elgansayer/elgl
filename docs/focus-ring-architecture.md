# Relay + Spartan focus ring architecture

Issue: #5495 (`Spartan UI 0029`)

## Current implementation audit

The application already has one global keyboard-focus boundary in `frontend/src/styles.scss`:

- `:focus-visible` removes the browser outline and applies a 2px Relay primary ring with a 2px surface offset.
- `:focus:not(:focus-visible)` removes the synthetic ring for pointer focus.
- Spartan's `--ring` and `--sidebar-ring` aliases resolve to the same Relay primary token.
- Spartan Helm components may add component-specific `focus-visible:*` classes, but those classes must remain token-backed and must not create a competing colour system.

## Canonical contract

1. Keyboard focus is expressed with `:focus-visible`, never plain `:focus`, for visible focus decoration.
2. The default product focus indicator is a 2px ring with a 2px offset.
3. The ring colour is the Relay primary accent through `ring-primary` / Spartan `--ring`.
4. The offset colour is the active Relay page surface through `ring-offset-surface-500`.
5. Pointer focus must not leave a synthetic keyboard ring.
6. Component-specific focus styles may strengthen semantic feedback, but must keep the global ring visible and use Relay/Spartan tokens.
7. Focus styling must remain direction-agnostic.
8. Forced-colours/high-contrast mode remains authoritative when active.

## Enforcement

Run `npm run check:focus-ring-contract` from the repository root. `scripts/verify-focus-ring-contract.mjs` is wired into repository verification, and `frontend/design-preview/foundations/focus-ring.html` provides the design-preview reference.
