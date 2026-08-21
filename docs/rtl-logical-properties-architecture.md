# Relay + Spartan RTL logical-properties architecture

Issues: #5499 (`Spartan UI 0033`) and #5500 (`Spartan UI 0034`)

## Current implementation audit

The application already establishes `html[dir='rtl']` at the global Relay layer and uses logical Tailwind utilities such as `ms-*`, `me-*`, `ps-*`, and `pe-*` in shared styles. The migration risk is feature code reintroducing physical-direction utilities such as `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, or `right-*` where layout direction should mirror.

## Canonical contract

1. Direction-sensitive spacing uses logical start/end utilities or CSS logical properties.
2. Direction-sensitive positioning uses `inset-inline-start` / `inset-inline-end` or logical Tailwind equivalents.
3. Physical left/right values are allowed only when the visual meaning is intentionally physical and direction-independent, such as a media crop coordinate.
4. Shared Spartan/Helm wrappers must not impose a second RTL system; they inherit document direction.
5. Iconography that conveys direction must use the existing RTL-aware icon contract rather than ad-hoc transforms.
6. Light/dark theme behavior must remain identical under RTL; direction changes layout, not semantic color.

## Approved examples

```html
<div class="ms-3 pe-4 text-start">...</div>
```

```css
.callout {
  margin-inline-start: 1rem;
  padding-inline-end: 1rem;
}
```

## Prohibited patterns

Do not introduce direction-sensitive feature layout with `ml-*`, `mr-*`, `pl-*`, `pr-*`, `left-*`, `right-*`, `margin-left`, `margin-right`, `padding-left`, `padding-right`, `left`, or `right` when a logical equivalent exists.

## Verification

Run `npm run check:rtl-logical-contract`. The verifier checks the global RTL boundary and fails when changed frontend source lines introduce common physical-direction Tailwind/CSS patterns without an explicit `rtl-physical-ok` annotation on the same line.
