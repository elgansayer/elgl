# Surface and elevation model

Status: authoritative contract for `[Spartan UI 0009]` and `[Spartan UI 0010]`.

Relay owns the product surface hierarchy and elevation language. Spartan components consume those roles; they do not introduce a parallel shadow or background scale.

## Surface roles

- `surface-500` is the application canvas/background.
- `surface-300` is an inset/control surface such as form fields.
- `surface-200` is the standard card, sheet and popover surface.
- `surface-100` is the standard border/divider and muted affordance surface.
- Other surface steps may be used where an existing Relay component already defines the role, but feature code should not invent a second elevation model by selecting arbitrary greys.

The light and dark values are independently designed. A semantic surface role therefore stays the same across themes even though its concrete RGB value changes.

## Elevation roles

Relay exposes two named shadow roles:

- `shadow-card`: standard resting elevation for cards and similar contained surfaces.
- `shadow-lift`: elevated or transient emphasis, including elevated cards and interactive hover lift.

`shadow-none` is valid for intentionally flat/outlined variants. Shared primitives must not use Tailwind's generic `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, arbitrary shadows, or hardcoded `box-shadow` values when a Relay role expresses the intended elevation.

## Shared card contract

`AppCardComponent` is the canonical presentation primitive for card surfaces:

- default: `bg-surface-200`, `border-surface-100`, `shadow-card`;
- elevated: same surface/border with `shadow-lift`;
- outlined: same surface with stronger border and `shadow-none`;
- interactive: rests at `shadow-card`, lifts to `shadow-lift`, and keeps visible keyboard focus.

Feature-specific content, layout and business state remain outside the primitive.

## Spartan integration

Generated Helm components should inherit Relay's semantic background/border aliases. Do not edit generated files to add product-specific shadows. If a reusable Helm-backed component needs product elevation, place the Relay role in its product wrapper.

## Accessibility

Elevation is supplementary, not the sole carrier of meaning. Selected, focused, active and modal states must retain semantic structure, borders, focus rings, labels or other cues when shadows are unavailable or visually subtle. Surface hierarchy must remain comprehensible in both themes and under high zoom.

## Prohibited patterns

- Generic Tailwind elevation (`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, `shadow-2xl`) inside shared Relay primitives.
- Arbitrary Tailwind shadows such as `shadow-[...]` in shared primitives.
- Hardcoded `box-shadow` declarations for product primitives when `shadow-card` or `shadow-lift` applies.
- New neutral background colours that bypass `surface-*` roles.
- Using stronger shadow alone to communicate a semantic state.

## Migration scope

The automated foundation gate applies immediately to shared Relay primitives. Existing feature-level generic shadows are converted by their numbered component/screen migrations to avoid changing unrelated screens in one architecture PR.

## Verification

Run:

```bash
cd frontend
npm run check:surface-elevation
```

The gate verifies that the canonical Relay shadow tokens still exist, `AppCardComponent` maps each variant to the expected roles, and shared primitive source does not reintroduce generic or arbitrary elevation values.
