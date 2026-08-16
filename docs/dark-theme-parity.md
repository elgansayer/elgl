# Dark theme parity

Status: authoritative contract for `[Spartan UI 0025]` and `[Spartan UI 0026]`.

Relay light and dark themes are independently designed implementations of the same semantic token contract. Dark mode is not an optional inversion layer and must not lag behind light-theme migrations.

## Semantic parity

Every theme-sensitive Relay variable introduced in the light `:root` token block must have a corresponding definition in `.dark`, and vice versa. This includes `--surface-*`, `--text-*`, `--colour-*`, `--on-fill-*` and `--shadow-*` roles. Theme-neutral motion timing remains shared.

Parity means matching semantic roles, not matching RGB mathematics. Dark values are independently chosen for contrast, hierarchy and readability.

## Spartan integration

Spartan semantic variables remain aliases into Relay variables. They must not add a second `.dark` product palette that can drift from Relay. Components using semantic Tailwind/Helm roles inherit the active Relay theme automatically.

## Component rules

- Shared primitives use semantic roles rather than component-local light/dark literals.
- A visual contract changed in light mode is reviewed in dark mode in the same migration.
- Saturated fills use the theme-aware on-fill role.
- Focus, borders, disabled states and overlay surfaces receive dark-mode verification, not only background and text colours.
- Per-user primary accent overrides continue to feed the same primary semantic role in both themes.

## Prohibited patterns

- Adding a theme-sensitive Relay token to only one theme.
- Deriving dark mode with filters, inversion or opacity tricks over the light palette.
- Component-local dark-mode colour literals when a semantic Relay role exists.
- A separate Spartan-owned dark product palette.
- Shipping a shared visual contract with only light-theme verification.

## Verification

Run:

```bash
cd frontend
node scripts/check-dark-theme-parity.mjs
```

The guard compares the complete theme-sensitive semantic key sets in `:root` and `.dark` and fails if either theme gains or loses a role independently.
