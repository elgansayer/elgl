# Semantic colour roles

Status: authoritative contract for `[Spartan UI 0007]` and `[Spartan UI 0008]`.

Relay owns product colour semantics. Spartan semantic variables are aliases into Relay roles and must not become a second palette.

## Roles

- `primary` is the user's Ember action/accent colour and may change at runtime.
- `secondary` in Relay is Tide, the partner colour. Spartan's `--secondary` is an affordance role and maps to a neutral Relay surface rather than Tide.
- `danger`, `success`, `warning`, `vip`, and `accent` are semantic product roles, not arbitrary decorative substitutes.
- `primary-ink`, `secondary-ink`, and `danger-ink` are AA-safe foreground roles for those semantic hues on neutral surfaces.
- `surface-*` expresses elevation/background structure.
- `text-primary`, `text-secondary`, and `text-muted` express text hierarchy.
- `on-fill` is the only default foreground for text/icons placed directly on saturated semantic fills.

## Saturated fills and `on-fill`

The light theme uses a paper foreground on saturated fills, while the dark theme intentionally uses ink because its semantic fills are brighter. Therefore `text-white`, `#fff`, and equivalent literals are not valid generic foregrounds for primary, danger, success, warning, vip, accent, or Tide-filled product controls.

Correct:

```html
<button class="bg-primary text-on-fill">...</button> <span class="bg-danger text-on-fill">...</span>
```

Incorrect:

```html
<button class="bg-primary text-white">...</button>
```

Tinted semantic backgrounds, for example `bg-primary/10`, normally use the semantic colour itself or a text token rather than `on-fill`, subject to contrast testing.

Use `text-primary-ink`, `text-secondary-ink`, or `text-danger-ink` for semantic text and icons on neutral surfaces. The fill roles remain available for backgrounds, borders, rings and form accents. `ThemeService` derives a light-mode `primary-ink` from a custom per-user accent and keeps it in sync with theme changes.

## Spartan aliases

Spartan Helm components may consume `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--destructive`, and related semantic aliases. Those aliases must resolve through Relay CSS variables. Regeneration must not restore a literal upstream palette.

## Scope of the migration guard

The architectural guard covers shared Relay primitives, global primitive classes and feature source. It rejects use of `primary`, `secondary` or `danger` fill utilities as foreground colours while preserving those roles for fills, borders, rings and form accents.

## Accessibility

- Semantic meaning must not rely on colour alone.
- Text/icon contrast on saturated fills must use the theme-aware foreground role.
- Semantic text and icons on neutral surfaces must use the corresponding `*-ink` role.
- Focus, selected, error, success and warning states need a non-colour cue where meaning would otherwise be ambiguous.
- Light and dark themes are independently designed and must both be tested.
- User-selected primary accents must remain readable because the foreground is role-based rather than hardcoded.

## Prohibited patterns

- `text-white` or literal white on a shared saturated semantic fill.
- New literal hex/rgb product colours where a Relay token exists.
- Treating Relay `secondary` and Spartan `--secondary` as interchangeable product meanings.
- Encoding semantic state only as colour.
- Introducing a new Spartan-owned colour scale separate from Relay.

## Verification

Run:

```bash
cd frontend
npm run check:semantic-colour-roles
```

The gate verifies the theme-aware `on-fill` contract, the AA-safe ink roles, Spartan foreground aliases, the shared primary-button primitive, saturated-fill plus hardcoded-white regressions, and legacy fill-token foregrounds throughout frontend source.
