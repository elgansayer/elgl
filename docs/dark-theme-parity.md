# Dark theme parity

Status: authoritative contract for `[Spartan UI 0025]` and `[Spartan UI 0026]`.

Relay light and dark themes are independently designed implementations of the same semantic token contract. Dark mode is not an optional inversion layer and must not lag behind light-theme migrations.

## Semantic parity

Every theme-sensitive Relay variable introduced in the light `:root` token block must have a corresponding definition in `.dark`, and vice versa. This includes:

- `--surface-*`
- `--text-*`
- `--color-*`
- `--on-fill-*`
- `--shadow-*`

Theme-neutral values such as motion timing are intentionally shared and do not require duplication.

Parity means matching semantic roles, not matching RGB mathematics. Dark values are independently chosen for contrast and hierarchy.

## Spartan integration

Spartan semantic variables remain aliases into Relay variables. They must not add a separate `.dark` palette that can drift from Relay. A component using `bg-primary`, `text-text-primary`, `bg-surface-200`, `text-on-fill`, or Spartan's aliases should inherit the correct concrete value from the active Relay theme automatically.

## Component rules

- Shared primitives must use semantic tokens instead of hardcoded light/dark branches.
- A visual contract changed in light mode must be reviewed in dark mode in the same migration.
- Saturated fills use `on-fill`, whose dark value may deliberately differ from light.
- Focus, borders, disabled states and overlay surfaces require dark-mode review, not only background/text colours.

## Accessibility

Both themes must maintain usable contrast, visible focus and non-colour state cues. Dynamic primary accents must continue to work because the user override feeds the same semantic primary role in either theme.

## Prohibited patterns

- Adding a theme-sensitive Relay token to only one theme.
- Treating dark mode as `filter`, inversion or derived opacity over the light palette.
- Component-local dark-mode colour literals when a semantic Relay role exists.
- A second Spartan-specific dark palette.
- Shipping a shared visual contract with only light-theme verification.

## Verification

Run `cd frontend && node scripts/check-dark-theme-parity.mjs` or the aggregate `npm run check:design-foundations`.

The guard parses the Relay token blocks, verifies exact key parity for theme-sensitive semantic variables, and confirms Spartan aliases continue to point at Relay variables rather than owning separate theme values.
