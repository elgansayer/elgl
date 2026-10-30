# ThemeService and per-user accent contract

This document is the implementation contract for Spartan UI 0021-0024.

## Ownership

- `ThemeService` is the only application service that owns light, dark, and system theme state.
- Relay owns semantic colour roles and the theme-specific defaults defined in CSS, including the AA-safe primary text role.
- Spartan Helm components consume those semantic roles. Feature components must not create a second theme store or write independent product palettes.
- A user profile may override the Relay primary accent only through `ThemeService.loadFromProfile()` or `setPrimaryAccentColor()`.

## Theme behaviour

`currentTheme` supports `light`, `dark`, and `system`. In system mode the service follows `prefers-colour-scheme` and toggles the root `dark` class. Components must consume semantic tokens rather than inspect theme state to choose literal colours.

## Accent behaviour

A custom accent is either a valid six-digit hexadecimal colour (`#RRGGBB`) or `null`. `null` means no user override and allows Relay's theme-aware default primary and primary-text roles to apply.

The service must:

1. validate persisted and profile-sourced values before converting them to RGB;
2. remove invalid persisted values instead of emitting malformed CSS variables;
3. clear the previous accent when a profile is absent or has no valid custom accent;
4. derive `--color-primary-text-rgb` in light mode by reducing the accent's HSL lightness until it reaches 4.5:1 against `surface-500`;
5. use the active primary value unchanged for the custom primary-text role in dark mode;
6. remove `--color-primary`, `--color-primary-rgb` and `--color-primary-text-rgb` when resetting so Relay defaults become authoritative again;
7. never let one user's profile accent leak into the next user's session.

## Prohibited patterns

Do not:

- write `--color-primary`, `--color-primary-rgb` or `--color-primary-text-rgb` from feature components;
- store separate feature-local theme/accent signals;
- accept arbitrary CSS colour syntax for profile accents without extending the validation contract and tests;
- keep the previous profile accent when the active profile becomes null or has no valid accent;
- hard-code alternate light/dark product colours where Relay semantic tokens already exist.

## Verification

Run from `frontend/`:

```bash
node scripts/check-theme-accent-contract.mjs
npm run lint:check
npm test -- --watch=false
npm run build
```

The focused contract check fails if ThemeService loses validation, explicit reset behaviour, root semantic-variable ownership, or root dark-class application. Canonical CI also executes the focused guard for changes to the service, its tests, or this contract. Unit tests cover persistence validation, profile changes, CSS variable reset/application, theme switching and AA-safe custom accent text derivation.
