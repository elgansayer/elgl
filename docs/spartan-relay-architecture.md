# Spartan UI and Relay architecture

Status: authoritative migration contract for the Spartan UI + Claude Design conversion.

This document defines the ownership boundary between Spartan Brain, generated Spartan Helm components, Relay presentation, and feature code. It applies to all new UI work and to the numbered `[Spartan UI ####]` migration backlog.

## 1. Layer ownership

The frontend has four UI layers. Dependencies must flow downward only.

1. **Feature surfaces**: route components, pages, modals and feature-specific composition. Feature code owns product behaviour, data flow, analytics hooks and layout composition. It must not reimplement generic keyboard, focus, overlay or selection behaviour already provided by an approved shared primitive.
2. **Relay primitives**: product-facing shared components under `frontend/src/app/components/primitives/`. Relay primitives own the public product API, Relay token mapping, design-system naming, i18n-safe labels, responsive defaults and product-specific variants.
3. **Spartan Helm components**: generated presentation components under `frontend/src/app/components/ui/`. Helm owns the styling bridge around Spartan Brain. Generated files should stay close to upstream so future Spartan upgrades remain reviewable.
4. **Spartan Brain**: `@spartan-ng/brain/*`. Brain owns accessible interaction state machines such as dialog focus management, combobox navigation and selection, menu behaviour and other headless interaction contracts.

Feature surfaces may use a Spartan Helm component directly only when no Relay primitive exists and the usage is genuinely feature-specific. Once a Relay primitive exists for the same interaction class, new feature code must use the Relay primitive instead of importing Brain or Helm directly.

## 2. Public API policy

Relay is the stable product-facing API. Spartan is an implementation dependency.

- Feature code should import `app-*` primitives for reusable product controls.
- Feature code must not import `@spartan-ng/brain/*` directly when an approved Relay primitive exists.
- Generated `hlm-*` APIs may be used directly for one-off composition while a capability is being introduced, but repeated usage is a signal to create or extend a Relay primitive.
- A Relay primitive may wrap one or more Helm directives/components and may expose only the product-level inputs and outputs required by callers.
- Relay primitives must not leak Spartan implementation types through their public inputs or outputs unless no stable product abstraction is possible.
- Feature-specific business state must not be pushed into Relay or Spartan layers.

## 3. Current ownership map

| Capability | Target owner | Migration rule |
| --- | --- | --- |
| Button behaviour | Relay wrapper over Spartan button where useful | Consolidate product variants and preserve Relay tokens. Do not create new bespoke button state machines. |
| Dialog / modal | Relay composition over Spartan Dialog | Spartan owns focus trap, Escape, backdrop and open state mechanics. Relay owns mobile bottom-sheet presentation and product layout defaults. |
| Combobox / language picker | Relay wrapper over Spartan Combobox | Spartan owns keyboard navigation and selection mechanics. Relay owns flag/language rendering, tokens and product API. |
| Select | Relay wrapper over Spartan Select | Use for controlled settings/form selection. Avoid hand-rolled keyboard navigation. |
| Dropdown / context menu | Relay wrapper when a real reusable pattern exists | Do not convert bottom-sheet action lists into cursor menus simply because both contain actions. |
| Popover / tooltip | Relay wrapper when reused | Spartan owns focus/escape/anchor behaviour. Relay owns visual treatment and content conventions. |
| Cards | Relay bespoke primitive | Cards are presentation/layout, not an interaction state machine. Do not add Brain solely for visual containers. |
| Inputs / textarea | Relay primitive, optionally Helm-backed | Preserve native semantics, attribute forwarding, error state and i18n. |
| Chips / pills / badges | Relay bespoke primitive unless interactive semantics require Brain | Static presentation stays Relay-only. Interactive selection must use the correct accessible interaction primitive. |
| Toast / feedback | Relay primitive | Preserve announcement semantics and semantic colour roles. |
| Empty / loading / error states | Relay presentation primitives | No Brain dependency unless an actual interactive control is present. |

## 4. Token ownership

Relay tokens are the source of truth for product styling. Spartan semantic variables are aliases into Relay, not a second design system.

- Product colours come from Relay CSS variables and Tailwind token mappings.
- `primary` remains dynamic per user through `ThemeService.setPrimaryAccentColor()`.
- `secondary` remains the fixed Tide partner colour in Relay. Spartan's generic `--secondary` semantic variable may map to a neutral affordance surface where required by Helm semantics. Do not assume equal names mean equal product roles.
- Text on saturated fills uses `on-fill`; do not hardcode white text.
- Light and dark themes are independently designed and equally supported.
- New hardcoded product hex values are prohibited when an existing Relay token can express the role.
- Radius, shadow and motion values must come from the existing Relay hierarchy unless a documented capability gap is added first.

## 5. Responsive and accessibility contract

Every migrated primitive and surface must preserve these invariants:

- Mobile-first baseline at 390px.
- Tablet and desktop layouts must be intentional, not stretched mobile layouts.
- Logical directional utilities and CSS logical properties only for directional layout.
- WCAG AA colour contrast.
- Deterministic keyboard focus order and visible focus.
- Correct accessible name, role and relationship semantics.
- Touch targets appropriate for mobile interaction.
- Required content and actions remain available at 200% and 400% zoom/reflow.
- Reduced-motion preferences are honoured for non-essential animation.
- CJK, Arabic, Cyrillic, Devanagari and other supported scripts must not be forced through a display font without suitable glyph coverage.

## 6. i18n contract

UI architecture must not move presentation classes or styling decisions into translation data.

- User-facing strings use `TranslatePipe` or `I18nService` according to `AGENTS.md`.
- Translation keys contain content, not Tailwind class lists.
- Layout and visual variants are typed component inputs or component-owned classes.
- Directionality is driven by locale/document direction and logical CSS, not duplicated LTR/RTL templates.

## 7. Generated Spartan code policy

Files generated by `@spartan-ng/cli` live under `frontend/src/app/components/ui/`.

- Keep generated Helm code as close to upstream as practical.
- House-style exceptions needed for generated code belong in narrowly-scoped tooling configuration rather than broad source rewrites.
- Do not edit generated code to add product colours or product-specific copy. Put product behaviour in Relay wrappers.
- When upgrading Spartan, regenerate or compare against upstream before retaining local changes.

## 8. Migration decision tree

Before modifying a UI surface:

1. Search for an existing Relay primitive that already owns the interaction.
2. Search `components/ui/` for an installed Helm primitive.
3. Search recent PRs and issues for overlapping work.
4. If a reusable interaction exists in Spartan but not Relay, add or extend the smallest Relay wrapper needed by multiple callers.
5. If the element is presentation-only, keep it in Relay rather than introducing Brain unnecessarily.
6. Preserve the feature's product behaviour while replacing generic interaction mechanics.
7. Update tests and design-preview/Claude Design coverage for any changed visual or interaction contract.

## 9. Prohibited patterns

- New hand-rolled focus traps, Escape-key modal handlers, roving-tabindex implementations or combobox keyboard state when Spartan already supplies that behaviour.
- Direct Brain imports scattered across feature screens when a Relay primitive exists.
- A second colour/token system independent from Relay.
- Hardcoded physical-direction utilities such as `left-*`, `right-*`, `ml-*`, `mr-*`, `pl-*` or `pr-*` in migrated UI.
- Styling classes stored in translation dictionaries.
- Duplicate primitives with overlapping responsibilities.
- Replacing a presentation-only primitive with Spartan solely to increase framework usage.
- Changing product behaviour, analytics or route contracts as an incidental part of a visual migration.

## 10. Verification gate

For frontend implementation changes, run the repository-mandated verification commands before merge:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

Run focused unit tests while iterating, then run the full required gate before merge. A migration PR must fix its own failures rather than leaving a follow-up repair.

## 11. Claude Design and design-preview parity

The repository implementation remains the runtime source of truth. The "HelloTalk Design System" Claude Design project and `frontend/design-preview/` are visual contract mirrors.

- Update the relevant primitive preview when a shared visual contract changes.
- Update representative screen previews when a feature surface changes materially.
- Capture light and dark states for theme-sensitive changes.
- Include mobile and wider responsive states when layout behaviour changes.
- Do not create a second Claude Design project for this migration.

## 12. Rollback strategy

Migrations should be small enough to revert independently. Preserve feature inputs/outputs and data contracts so a migrated primitive can be reverted without reverting unrelated product work. If a Spartan primitive introduces a regression that cannot be corrected inside the current PR, revert that migration rather than shipping a partially accessible fallback.

This contract resolves `[Spartan UI 0001]` and `[Spartan UI 0002]` as the architectural basis for subsequent numbered tickets.