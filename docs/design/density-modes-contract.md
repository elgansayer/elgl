# Relay + Spartan density modes contract

This document defines the canonical compact, standard and comfortable density contract for Relay presentation components built on Spartan interaction primitives.

## Ownership

- Spartan Brain owns interaction behaviour and accessibility mechanics. Density must never fork or alter Brain state machines.
- Spartan Helm owns component composition where a Helm primitive already exposes sizing or density variants.
- Relay owns product-facing spacing, control sizing, typography scale and density semantics.
- Feature code consumes approved Relay/Helm variants. It must not reproduce compact/comfortable styling with one-off Tailwind overrides.

## Canonical modes

Relay exposes three semantic density levels through existing component size APIs:

| Semantic mode | Canonical component value | Purpose |
| --- | --- | --- |
| compact | `sm` | Dense desktop/tooling contexts, secondary controls and information-rich surfaces |
| standard | `md` | Default product density and the fallback when no explicit density is requested |
| comfortable | `lg` | Prominent actions, spacious cards and touch-oriented or low-density contexts |

`sm`, `md` and `lg` are implementation values, not user-facing copy. UI text must use translated semantic labels if a product setting eventually exposes density.

## Behavioural invariants

Changing density may change padding, gaps, control dimensions and the associated typography step. It must not change:

- accessible name, role, state or keyboard behaviour;
- focus order, focus visibility or focus restoration;
- light/dark semantic colour roles or per-user accent colour behaviour;
- RTL meaning or logical layout direction;
- validation, disabled, loading or error semantics;
- reduced-motion, forced-colours or high-contrast behaviour;
- content ordering, truncation rules or localization contracts.

Density is therefore a presentation concern. Do not use CSS `transform: scale(...)`, browser `zoom`, global font-size mutation or DOM branching to simulate it.

## Responsive and accessibility policy

Compact mode is not permission to create inaccessible targets or unreadable text. Interactive target requirements remain independent of glyph/content density and must follow the repository accessibility contract. Mobile layouts remain mobile-first; a component may resolve to standard or comfortable presentation at a narrow/coarse-pointer breakpoint when its compact form would compromise operation or reflow.

Density variants must behave identically in light and dark themes, with Relay semantic tokens continuing to own colour. Directional spacing must use logical properties/utilities so compact and comfortable layouts work unchanged in RTL. Long translated labels and CJK/Arabic/complex-script content must be allowed to grow or wrap according to the owning component contract rather than being clipped to preserve a density target.

## Component mapping

Current shared primitives establish the baseline contract:

- `AppCardComponent`: `sm` = compact padding, `md` = default padding, `lg` = comfortable padding.
- `AppButtonPrimaryComponent`: `sm` = compact action spacing/type, `md` = default action spacing/type, `lg` = comfortable action spacing/type.

New Relay primitives that expose density should use the same semantic mapping unless the underlying Spartan Helm API has a stronger capability-specific size model. In that case, document the translation at the Relay boundary rather than leaking a second density vocabulary into feature code.

## Preferred usage

```html
<app-card size="sm">...</app-card>
<app-button-primary size="md">...</app-button-primary>
<app-card size="lg">...</app-card>
```

Prefer the component API over caller-owned spacing overrides.

## Prohibited patterns

- Feature-level `p-*`, `gap-*`, text-size or height overrides used only to recreate a different density for a Relay primitive.
- `transform: scale(...)`, browser `zoom`, or root font-size changes as a density mechanism.
- Density-specific hardcoded product colours.
- Physical-direction spacing such as left/right padding to implement density.
- Different accessible labels, interaction logic or DOM order between density variants.
- A parallel `compact | cozy | dense` vocabulary that bypasses the canonical Relay mapping.

## Claude Design parity

Claude Design/design-preview representations of shared primitives must include compact, standard and comfortable states when density materially changes their visual contract. All three states should be reconciled against the same stable component identity rather than duplicated as unrelated components. Light/dark and representative long-label/RTL states belong to the same contract.

## Verification

Run:

```bash
cd frontend
npm run check:density-modes
npm run lint:check
npm test -- --watch=false
npm run build
```

`check:density-modes` fails if core Relay primitives lose the three canonical size variants, stop defaulting to standard density, introduce non-canonical density vocabulary, or use scaling/zoom hacks inside shared primitives.
