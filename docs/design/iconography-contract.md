# Relay + Spartan iconography contract

This document is the canonical project contract for routine product UI iconography.

## Ownership

- Spartan Helm owns component composition and icon placement where a Helm component already provides an icon slot or icon-bearing control.
- Spartan Brain owns headless interaction and accessibility behaviour. Do not fork Brain to change icon presentation.
- Relay owns visual semantics, including icon colour roles, density, control sizing, theme parity, per-user accent behaviour and state styling.
- `@ng-icons/core` with `@ng-icons/lucide` is the canonical generic vector icon stack.
- Flags, language indicators, avatars, user emoji, product illustrations, content media and brand marks are not generic UI icons and must remain separate from Lucide.

## Canonical glyph sizes

Routine UI glyphs use three sizes:

- 16px: compact controls, dense metadata and secondary inline actions.
- 20px: default controls, menu items, inputs and standard toolbar actions.
- 24px: prominent actions and large control affordances.

Prefer the size API of the owning Spartan/Relay component. At raw `<ng-icon>` call sites, use the corresponding Tailwind sizing utilities (`size-4`, `size-5`, `size-6`) only when the parent component does not already set icon size. Do not introduce arbitrary icon pixel sizes for routine product controls.

The clickable or tappable target is separate from glyph size. Preserve the project's touch-target and focus-ring requirements even when the glyph is 16px or 20px.

## Accessibility

- Decorative icons are hidden from the accessibility tree or otherwise prevented from producing redundant names.
- Icon-only interactive controls require a translated accessible name supplied by the owning button/control.
- Do not use icon names as user-visible or accessible text.
- Directional icons must follow the semantic direction of the action. Use RTL-aware composition for back/forward, previous/next, send and similar direction-sensitive actions rather than embedding left/right assumptions.
- Colour alone must not communicate state.

## Themes and colour

Icons inherit semantic Relay foreground roles by default. Do not add raw Tailwind palette colours or hardcoded hex/RGB values for routine product icons. Selected and accent states must continue to honour the per-user primary accent contract in both light and dark themes, including forced-colours/high-contrast behaviour.

## Registration and imports

Register Lucide glyphs with `provideIcons` at the narrowest practical application/component scope. Do not introduce Font Awesome, Material Icons, Heroicons, Phosphor, Tabler or another competing generic icon library.

## Prohibited patterns

- Hand-drawn inline SVG for a routine control icon when a suitable Lucide glyph exists.
- Unicode glyphs or emoji used as generic application controls.
- Feature-owned copies of Lucide SVG path data.
- Arbitrary routine icon sizes such as `size-[18px]` or inline `width`/`height` styling.
- Hardcoded physical-direction assumptions for semantic navigation controls.
- Styling generated Spartan Brain internals to bypass Helm/Relay ownership.

## Migration examples

Prefer:

```html
<button hlmBtn size="icon" [attr.aria-label]="'common.close' | t">
  <ng-icon name="lucideX" class="size-5" aria-hidden="true" />
</button>
```

Avoid:

```html
<button aria-label="Close">
  <svg width="18" height="18"><!-- copied path --></svg>
</button>
```

The first form keeps behaviour in the owning control, vector rendering in ng-icons/Lucide, visual semantics in Relay/Helm and the accessible name in i18n.

## Verification

Run:

```bash
cd frontend
npm run check:icon-contract
npm run lint:check
npm test -- --watch=false
```

`check:icon-contract` fails when the dependency stack gains a competing generic icon library, when shared Relay primitives introduce routine hand-authored inline SVG, or when arbitrary raw `<ng-icon>` sizing is added in shared primitives. Feature surfaces are migrated progressively by the numbered Spartan UI backlog; the guard intentionally starts at shared primitives so it can be tightened without blocking unrelated legacy feature migration.

When this contract changes visually, update the corresponding Claude Design/design-preview state in the same change so design and code stay bidirectionally reconcilable.