# Iconography and icon sizing

Status: authoritative contract for `[Spartan UI 0017]` and `[Spartan UI 0018]`.

Relay uses one canonical vector icon stack for product controls: `@ng-icons/core` with Lucide icons from `@ng-icons/lucide`. Spartan-generated components may use the same stack. Do not introduce a second general-purpose icon library for feature work.

## Visual categories

Not every visual glyph is the same kind of asset:

- **Product control icons:** use Lucide through `NgIcon`/`provideIcons` where an existing symbol fits.
- **Language flags:** flag emoji remain valid language indicators and are not replaced with Lucide.
- **Illustrations/empty-state artwork:** repository SVG/image assets are illustrations, not control icons.
- **User-generated emoji:** content, not interface iconography.

## Canonical sizes

Use a small named size set so controls align visually:

- 16px: compact supporting glyphs inside dense controls.
- 20px: default control/action icon.
- 24px: prominent standalone action or navigation icon.
- 32px+: exceptional display/status illustration only, not ordinary button chrome.

The clickable/tappable target remains larger than the glyph. An icon-only control must preserve the product touch-target and focus requirements regardless of whether the rendered icon itself is 16, 20 or 24px.

## Accessibility

- Decorative icons are hidden from assistive technology.
- Meaningful standalone icons require an accessible name on the owning control.
- Do not rely on an icon shape or colour alone for destructive/success/error meaning when ambiguity is possible.
- Icon-only buttons keep visible keyboard focus and a suitable touch target.
- Directional icons must be reviewed for RTL semantics; physical arrows should mirror only when their meaning is directional rather than intrinsic.

## Spartan integration

Generated Helm components may keep their upstream Lucide usage so regeneration remains reviewable. Relay wrappers own product-facing icon choice, label, size and target treatment. Do not edit generated files merely to replace Lucide with a feature-specific icon package.

## Prohibited patterns

- Adding another general-purpose icon dependency when Lucide provides the required symbol.
- Hand-drawing routine product-control SVG paths inside shared Relay primitives.
- Arbitrary icon sizes such as 17px or 23px without a documented component-specific reason.
- Using emoji as generic button chrome where a canonical control icon exists.
- Icon-only controls without an accessible name.

## Migration scope

This foundation gate protects dependency and shared-primitive ownership first. Existing feature-level inline SVG and icon sizing are migrated with their numbered component/screen tickets, where visual meaning and accessibility can be reviewed in context.

## Verification

Run:

```bash
cd frontend
npm run check:iconography
```

The gate verifies the canonical ng-icons/Lucide dependencies, the existing Spartan dialog close control integration, rejects competing general-purpose icon-library imports in shared Relay primitives, and prevents new inline control SVG markup in those primitives.
