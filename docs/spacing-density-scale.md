# Spacing and density scale

Status: authoritative contract for `[Spartan UI 0013]` and `[Spartan UI 0014]`.

Relay uses Tailwind's shared spacing scale with explicit component density mappings. Shared primitives must compose spacing from the scale rather than introducing arbitrary pixel values.

## Density roles

Shared controls expose product-level size/density variants rather than raw spacing inputs:

- `sm`: compact supporting controls, using the smaller established padding steps.
- `md`: standard/default product density.
- `lg`: comfortable/high-emphasis controls and containers.

Examples already established by Relay:

- `AppCardComponent`: `sm` = 3, `md` = 4, `lg` = 6 spacing steps on each logical side.
- `AppButtonPrimaryComponent`: size variants use named Tailwind spacing steps and preserve larger horizontal than vertical padding.
- Inputs/textareas use logical `ps`/`pe` with stable vertical padding rather than physical-direction declarations.

## Directionality

Directional spacing must use logical utilities (`ps`, `pe`, `ms`, `me`) or logical CSS properties. Physical left/right spacing is prohibited by the existing RTL gate and remains part of this density contract.

## Arbitrary values

Shared Relay primitives must not use arbitrary spacing utilities such as `p-[13px]`, `gap-[7px]`, `space-x-[...]`, or hardcoded CSS `padding`/`margin` declarations when the normal scale expresses the layout. A genuine new scale requirement should be documented centrally before use.

Feature-level legacy arbitrary spacing is migrated with the relevant numbered screen/component ticket rather than rewritten wholesale by this foundation change.

## Accessibility and zoom

Density must not shrink interactive targets below usable mobile sizes or cause translated text to clip. Compact density may reduce whitespace but not accessible names, focus indication, or required content. At 200% and 400% zoom, spacing must allow natural reflow instead of depending on fixed pixel geometry.

## Spartan integration

Spartan/Helm components may retain upstream internal spacing where regeneration fidelity matters. Relay wrappers own product-facing density defaults and translate product variants to stable spacing classes. Feature code should consume those variants instead of patching generated components with one-off padding.

## Prohibited patterns

- Arbitrary Tailwind spacing values in shared Relay primitives.
- Hardcoded `padding`, `margin`, `gap`, `row-gap`, or `column-gap` CSS declarations in shared primitives when the standard scale applies.
- New public primitive APIs exposing raw pixel padding/margin values.
- Physical-direction spacing utilities in migrated UI.
- A compact variant that compromises touch target, focus ring, translated-text or zoom/reflow usability.

## Verification

Run:

```bash
cd frontend
npm run check:spacing-density
```

The gate verifies canonical card/button density mappings and scans shared primitive source for arbitrary Tailwind spacing and hardcoded CSS spacing declarations. The existing RTL logical-spacing gate continues to enforce directional correctness across the whole application.
