---
name: angular-feature-component
description: "Scaffold a new standalone Angular component under frontend/src/app/components following this project's Relay, Spartan, signals, i18n, RTL, accessibility and Claude Design reconciliation rules. Use when adding a new UI component, page, modal, or feature surface."
---

# Angular Feature Component

## Before implementation

1. Read `AGENTS.md`, `DESIGN.md`, `docs/spartan-relay-architecture.md` and `docs/claude-design-two-way-sync.md`.
2. Search existing components, GitHub issues and active PRs for overlapping work.
3. Map every interactive control to an existing Relay public API and, where applicable, its Spartan capability before writing bespoke interaction code.
4. Check `design-sync.manifest.json` and `frontend/design-preview/` for an existing visual contract.

## File layout

Mirror the established feature layout when separate template/style files are useful:

```
frontend/src/app/components/<feature>/
├── <feature>.component.ts
├── <feature>.component.html
├── <feature>.component.scss
└── <feature>.component.spec.ts
```

Inline templates/styles are also acceptable when consistent with nearby code. Never create an unused duplicate sibling template or stylesheet.

## Component rules

```typescript
@Component({
  selector: 'app-<feature>',
  imports: [TranslatePipe /* + approved Relay/Helm imports actually used */],
  templateUrl: './<feature>.component.html',
  styleUrl: './<feature>.component.scss',
})
export class FeatureComponent {}
```

- Do not add `standalone: true` or explicit OnPush metadata when they are framework defaults.
- Use `inject()` rather than constructor injection.
- Use `signal()` / `computed()` for component state and derivation.
- Use `input.required<T>()` / `input<T>()`, `output<T>()`, and signal queries rather than legacy decorators.
- Use the repository-approved async patterns from `AGENTS.md`; do not introduce ad-hoc subscriptions or lifecycle-driven data loading.
- Do not introduce duplicate services/components or assume an external API/provider/package exists without verifying it.

## Relay + Spartan ownership

- Feature code consumes approved Relay public APIs and semantic tokens.
- Spartan Brain is the accessible behaviour layer and project-owned Helm is the implementation/styling layer. Feature components should not import Brain directly when an approved Relay/Helm abstraction exists.
- Run `npm run check:spartan-boundaries`; never add a permanent exception merely to make the check pass.
- Prefer existing variants and semantic roles before adding one-off utility combinations.
- Do not restore the retired `app-button-primary`, `app-card`, `app-chip` or similar legacy primitive catalogue as a parallel design system. Existing legacy uses should be migrated through their numbered Spartan issues rather than copied into new work.
- Original HelloTalk screenshots may inform product behaviour and information architecture, but are not current palette or pixel-parity authority.

## Template and styling rules

- Use native Angular control flow: `@if`, `@for`, `@switch`.
- Use stable identities in `@for`.
- Use native class/style bindings rather than `ngClass`/`ngStyle`.
- Use logical direction utilities/properties for RTL.
- Use Relay semantic tokens rather than raw product colours where a semantic role exists.
- Preserve first-class light and dark themes and per-user accent semantics.
- Ensure responsive behaviour is intentionally designed for mobile, tablet and desktop where layout changes.

## Internationalisation

Every user-facing string goes through `TranslatePipe` or `I18nService`. Add translation keys through the repository's i18n workflow rather than hard-coding feature copy.

## Accessibility

Every interactive component must meet WCAG AA minimums and preserve the accessibility supplied by Spartan primitives. Verify as applicable:

- keyboard operation and deterministic focus order,
- visible focus,
- screen-reader names/roles/states,
- disabled/error/loading semantics,
- touch and pointer operation,
- RTL,
- 200% and 400% zoom/reflow,
- reduced motion,
- forced colours/high contrast,
- state cues that do not depend on colour alone.

## Claude Design and previews

For material visual/interaction-contract changes:

1. Identify or add the stable design-sync ID.
2. Update the deterministic repository preview.
3. Use the design-first, code-first or reconciliation flow from `docs/claude-design-two-way-sync.md`.
4. Reconcile with the canonical HelloTalk Design System Claude Design project before marking the visual contract complete.

For a genuinely non-visual implementation change, explicitly document why design sync is not required.

## Tests

Every component needs relevant unit coverage for creation, signal-driven behaviour, outputs and interaction/accessibility regressions. Add integration/E2E coverage for critical user flows rather than relying only on shallow creation tests.

## Verification

Run the `verification-gate` frontend steps plus:

```bash
npm run check:spartan-boundaries
npm run check:design-sync
```

A feature is not complete merely because it builds. It must satisfy runtime behaviour, tests, accessibility, Relay/Spartan ownership and applicable preview/Claude Design reconciliation.