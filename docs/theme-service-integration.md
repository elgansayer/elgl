# Theme service integration

Status: authoritative contract for `[Spartan UI 0021]` and `[Spartan UI 0022]`.

`ThemeService` is the single product owner for light/dark/system preference. Relay CSS variables own the concrete theme palette; Spartan semantic variables alias into Relay and must not create an independent theme toggle.

## Contract

- Public theme values are `light`, `dark`, and `system`.
- Preference persists under `app_theme`.
- `system` resolves through `prefers-color-scheme: dark` and reacts to system changes.
- The resolved DOM state is represented by the `dark` class on `document.documentElement`.
- Components consume semantic tokens/classes and never branch their own palette based on theme.
- Theme selection is independent from the per-user primary accent override.

## Spartan integration

Spartan/Helm components inherit the Relay variables and `.dark` state. Feature or generated components must not add a second dark-mode service, write independent theme attributes, or replace the root class contract.

## Accessibility

Both themes are first-class and must preserve semantic contrast, focus visibility and reflow. System theme changes must not reset user data or primary accent selection.

## Prohibited patterns

- Component-local `matchMedia('(prefers-color-scheme: dark)')` for product theming.
- Direct component writes to the root `dark` class instead of `ThemeService`.
- Additional theme persistence keys for the same light/dark/system preference.
- Hardcoded light/dark colour branches where Relay semantic tokens exist.

## Verification

Run `cd frontend && npm run check:theme-service`. The guard verifies the public theme union, persistence key, system media query, root dark-class ownership, and the presence of independently defined Relay light/dark token blocks.
