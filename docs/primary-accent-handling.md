# Per-user primary accent handling

Status: authoritative contract for `[Spartan UI 0023]` and `[Spartan UI 0024]`.

Relay `primary` is dynamic per user. `ThemeService` owns the runtime override while the light/dark Ember values in CSS remain the fallback when no valid user preference exists.

## Input contract

- Stored/profile accent values must be six-digit hexadecimal colours (`#RRGGBB`).
- Invalid persisted values are discarded rather than converted into invalid CSS.
- `setPrimaryAccentColor()` validates before updating state or persistence.
- Clearing the accent removes the persisted override and the inline CSS variables so the active light/dark Relay fallback becomes visible again.

## User lifecycle

Accent state must not leak between profiles. `loadFromProfile()` applies a valid profile accent; a profile with no valid custom accent (including `null` during logout/reset) clears the previous override.

This distinction is important because `--color-primary-rgb` is an inline root override. Leaving it in place would survive theme changes and could visually carry one user's preference into another session.

## Token integration

A valid accent updates:

- `--color-primary-rgb` for Tailwind/Relay alpha-aware colour utilities;
- `--color-primary` for legacy consumers that still reference the full colour value.

Spartan's `--primary`, focus rings, buttons and other semantic aliases continue to consume Relay's primary variable. Feature code must not copy the user accent into local component colours.

## Accessibility

Dynamic primary use must pair saturated fills with `on-fill` rather than hardcoded white. Any future unrestricted colour picker must also enforce/derive accessible pairings; this contract only guarantees valid colour syntax and correct lifecycle ownership.

## Prohibited patterns

- Applying profile accent values directly in feature templates/styles.
- Persisting unvalidated arbitrary strings as the primary accent.
- Keeping a previous user's accent when the next profile has no custom value.
- Overwriting Relay's dark/light fallback values instead of using the root inline override/removal mechanism.
- Hardcoding white foregrounds on dynamic primary fills.

## Verification

Run `cd frontend && node scripts/check-primary-accent.mjs` or the aggregate `npm run check:design-foundations`. Unit tests additionally cover valid persisted accents, invalid-value rejection and clearing a previous profile's override.
