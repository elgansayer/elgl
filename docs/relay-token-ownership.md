# Relay design token ownership

Status: authoritative contract for `[Spartan UI 0003]` and the verification gate in `[Spartan UI 0004]`.

Relay is the only product design-token authority. Tailwind exposes Relay tokens to application code, while Spartan Helm semantic variables alias those same Relay variables for Spartan-generated components. Spartan must never introduce a parallel colour system.

## Ownership chain

The required dependency direction is:

`Relay CSS variables -> Tailwind Relay tokens -> Spartan semantic aliases -> Helm / Relay primitives -> feature surfaces`

The sources of truth are:

- `frontend/src/styles.scss`: light and dark Relay CSS-variable values and Spartan semantic aliases.
- `frontend/tailwind.config.js`: Tailwind names for Relay colour, radius, shadow and motion tokens.
- `frontend/src/app/services/theme.service.ts`: runtime theme selection and per-user primary accent updates.
- `frontend/src/app/components/ui/`: generated Helm code consuming Spartan semantic variables.
- `frontend/src/app/components/primitives/`: product-facing Relay primitives consuming Relay/Tailwind semantics.

## Product colour roles

| Relay role | Owner | Spartan mapping rule |
| --- | --- | --- |
| `surface-*` | Relay | Background, card, popover, border, input and muted aliases map to an appropriate Relay surface. |
| `primary` / Ember | Relay + per-user ThemeService override | Spartan `--primary`, `--ring` and primary sidebar aliases use `--colour-primary-rgb`. |
| `secondary` / Tide | Relay | Tide remains the partner/product colour. Spartan `--secondary` is an affordance role and intentionally maps to a neutral Relay surface, not Tide. |
| `danger` | Relay | Spartan `--destructive` maps to `--colour-danger-rgb`. |
| `success`, `warning`, `vip` | Relay | Product semantics remain Relay-owned and are not replaced by generic Spartan palette values. |
| `accent` | Relay | Spartan `--accent` maps directly to `--colour-accent-rgb`. |
| `on-fill` | Relay | Foregrounds on saturated fills map to `--on-fill-rgb`; hardcoded white is not an acceptable substitute. |
| `text-*` | Relay | Spartan foreground aliases map to Relay text roles. |

## Theme ownership

Light and dark values are independently authored in Relay's `:root` and `.dark` token blocks. The Spartan alias block is intentionally theme-agnostic: it references Relay variables with `var()` so the active Relay theme determines the resolved value.

Do not duplicate the Spartan alias block under `.dark`. Doing so creates a second theme authority and makes future Relay changes incomplete by default.

`primary` is additionally runtime-mutable through the existing theme service. Any Spartan or Relay component that represents the user's primary accent must therefore resolve through `--colour-primary-rgb`, never through a copied hex, static RGB value or generated Spartan default.

## Allowed literal colours

Literal colours are allowed only where `DESIGN.md` explicitly defines a static decorative tint scale, such as the existing decorative neon/accent tint entries in `tailwind.config.js`. They are not allowed inside the Spartan semantic alias block or as replacements for semantic product colours in feature code.

A new literal product colour requires a documented Relay token first. Add the token to both theme branches where theme-sensitive, expose it through Tailwind when needed, then map any Spartan semantic alias to that Relay token.

## Prohibited patterns

- Replacing Relay-backed Spartan aliases with the default Spartan `oklch()` palette.
- Adding hardcoded hex, RGB, HSL or OKLCH colour literals to the Spartan semantic alias block.
- Defining independent `.dark` Spartan colours instead of aliasing theme-aware Relay variables.
- Mapping Spartan `--primary` to a static value, which would break per-user accents.
- Treating Spartan `--secondary` as equivalent to Relay Tide simply because the names match.
- Using `text-white` for saturated semantic fills when `text-on-fill` is the product contract.
- Introducing feature-local colour variables when an existing Relay semantic role fits.

## Verification gate

Run:

```bash
cd frontend
npm run check:relay-token-ownership
```

The gate verifies that:

1. Required Relay semantic CSS variables remain represented in both light and dark token ownership blocks.
2. Tailwind continues to map the required semantic roles to Relay CSS variables.
3. Spartan semantic aliases resolve directly to approved Relay variables.
4. The Spartan alias block contains no literal colour palette values.
5. Dynamic primary and `on-fill` mappings remain intact.

The gate is intentionally structural rather than screenshot-based. Visual regression and contrast coverage remain complementary checks, but they cannot by themselves detect a second palette being reintroduced by a future Spartan regeneration.

## Migration examples

Correct:

```scss
--primary: rgb(var(--colour-primary-rgb));
--primary-foreground: rgb(var(--on-fill-rgb));
--destructive: rgb(var(--colour-danger-rgb));
```

Incorrect:

```scss
--primary: oklch(0.62 0.2 30);
--primary-foreground: #fff;
--destructive: rgb(220 38 38);
```

Correct feature styling uses Relay/Tailwind semantics such as `bg-primary`, `text-on-fill`, `bg-surface-200`, `text-text-secondary` or a shared primitive that already owns those choices. Feature surfaces should not know or reproduce the underlying RGB values.
