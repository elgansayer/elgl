# Spartan tree-shaking policy

Status: authoritative architecture standard for `[Spartan UI 0067]`.

This document defines how the Angular frontend must consume Spartan Brain, repository-owned Spartan Helm sources, and Relay product primitives without pulling unused UI capabilities into application bundles. It supplements `docs/spartan-relay-architecture.md`, `docs/component-system-convergence.md`, and the frontend bundle-size budget.

The objective is not to minimise import count at any cost. The objective is to keep interaction ownership correct, preserve accessibility and design-system behaviour, and make the JavaScript dependency graph as precise as the product surface allows.

## 1. Scope

This policy applies to:

- `@spartan-ng/brain` imports;
- repository-owned Helm sources under `frontend/src/app/components/ui/`;
- `@spartan-ng/helm/*` TypeScript aliases;
- Relay primitives under `frontend/src/app/components/primitives/`;
- standalone Angular component `imports` arrays;
- route-level lazy loading;
- providers and optional UI integrations that can move code into the initial browser bundle;
- generated Spartan code added or removed with `@spartan-ng/cli`;
- future automated migration checks introduced by `[Spartan UI 0068]`.

This policy does not require product code to bypass Relay abstractions just to save a few bytes. The Relay and Spartan ownership boundaries remain authoritative.

## 2. Current implementation audit

The current repository already has several strong tree-shaking foundations.

### 2.1 Angular build

`frontend/angular.json` uses the Angular application builder with the production configuration as the default build. The production browser build has an initial bundle budget of 2.5 MB warning and 3 MB error, plus the existing per-component style budget.

The build therefore already provides a coarse regression boundary for code that accidentally expands the initial browser graph.

The application uses standalone Angular components and route-level `loadComponent`/`loadChildren` boundaries across feature areas. This is the preferred route-level code-splitting model. New feature work must not reintroduce eager feature modules solely to share UI primitives.

### 2.2 Spartan package ownership

`frontend/package.json` currently owns:

- `@spartan-ng/brain` as the runtime Spartan dependency;
- `@spartan-ng/cli` as a development dependency;
- repository-owned Helm source instead of a runtime `@spartan-ng/helm` package dependency.

The Brain and CLI release lines are already checked by `frontend/scripts/check-spartan-health.mjs`.

### 2.3 Repository-owned Helm source

Generated Helm source lives under:

```text
frontend/src/app/components/ui/
```

The current surface contains focused primitive directories such as button, checkbox, combobox, dialog, input, native-select, popover and radio-group.

`frontend/tsconfig.json` maps each public Helm import to one primitive-specific local entry point. For example:

```json
{
  "paths": {
    "@spartan-ng/helm/button": ["./src/app/components/ui/button/src/index.ts"],
    "@spartan-ng/helm/dialog": ["./src/app/components/ui/dialog/src/index.ts"],
    "@spartan-ng/helm/checkbox": ["./src/app/components/ui/checkbox/src/index.ts"]
  }
}
```

There is intentionally no catch-all `@spartan-ng/helm` alias that exports the entire local component system.

### 2.4 Brain import boundary

Repository-owned Helm files import the precise Brain capabilities they implement, such as `@spartan-ng/brain/dialog` or another primitive subpath.

Feature and Relay code must not import Brain directly. `scripts/verify-spartan-boundaries.mjs` already enforces that direct `@spartan-ng/brain/*` imports stay inside the owned Helm directory.

This boundary is important for both architecture and bundle precision. Feature code should not accumulate Brain imports that bypass the local Helm/Relay ownership graph.

### 2.5 Current import shape

The current source tree uses primitive-specific `@spartan-ng/helm/*` entry points. No product-facing root `@spartan-ng/helm` import is required.

The current source tree also avoids a production root `@spartan-ng/brain` import. Brain imports are concentrated in the generated Helm layer.

These are desirable properties and must be preserved.

### 2.6 Existing risk areas

Tree-shaking can still regress even when the build succeeds. The main risks are:

1. adding a root barrel that re-exports every Helm primitive;
2. using wildcard namespace imports from Spartan packages;
3. importing several unrelated primitives through one convenience barrel;
4. making feature routes eager when they were previously lazy;
5. registering feature-specific providers globally;
6. adding module-level side effects to Helm or Relay entry points;
7. retaining generated primitives after their final product consumer has been removed;
8. dynamically selecting primitives through opaque registries that force the bundler to retain every candidate;
9. importing optional heavy integrations from the app shell rather than the feature that uses them;
10. weakening the production bundle budget because a migration increased bundle size.

## 3. Core architecture rule

The import graph must follow the same ownership graph as the UI architecture:

```text
feature surface
    |
    v
Relay primitive, when one exists
    |
    v
specific repository-owned Helm primitive
    |
    v
specific Spartan Brain subpath
```

Dependencies flow downward only.

A feature must not import more Spartan capability than its interaction contract needs. A feature must also not skip Relay or Helm ownership simply because a lower-level import appears smaller.

Correct abstraction first, precise entry point second.

## 4. Spartan Brain import policy

### Required

Repository-owned Helm source must import Brain from the narrowest supported public subpath for that primitive.

Example:

```ts
import { BrnDialog } from '@spartan-ng/brain/dialog';
```

Feature and Relay code must consume the approved Helm or Relay boundary instead.

### Prohibited

Do not add root or wildcard imports such as:

```ts
import * as SpartanBrain from '@spartan-ng/brain';
import { BrnDialog, BrnMenu, BrnSelect } from '@spartan-ng/brain';
```

Do not add direct Brain imports to feature components:

```ts
// Feature component: prohibited.
import { BrnDialog } from '@spartan-ng/brain/dialog';
```

If a Brain capability is needed and no local Helm primitive exists, generate or implement the smallest approved Helm boundary first, then expose a Relay product primitive when the interaction is reusable.

## 5. Helm import policy

### Required

Product and Relay code must import Helm from a primitive-specific public alias:

```ts
import { HlmButtonDirective } from '@spartan-ng/helm/button';
import { HlmDialogComponent } from '@spartan-ng/helm/dialog';
```

The `@spartan-ng/helm/<primitive>` alias is the public boundary. Deep relative imports into generated files are not allowed.

### Prohibited root barrel

Do not create this shape:

```ts
// Prohibited convenience barrel.
export * from './button/src';
export * from './checkbox/src';
export * from './combobox/src';
export * from './dialog/src';
```

and then consume it as:

```ts
import { HlmButtonDirective, HlmDialogComponent } from '@spartan-ng/helm';
```

Even if a bundler can sometimes remove unused exports, the broad barrel makes ownership harder to audit, makes side-effect regressions more costly, and makes accidental coupling between primitives easier.

### Primitive barrels are allowed

A primitive-specific entry point may export the pieces needed to compose that primitive. Dialog, for example, naturally needs several closely-related directives/components.

The unit of tree-shaking policy is the interaction capability, not necessarily one TypeScript symbol.

## 6. Relay primitive policy

Relay is the stable product-facing API. Tree-shaking must not be used as a reason to bypass it.

A Relay primitive should:

- import only the Helm primitives needed for its product contract;
- avoid importing unrelated product primitives through a global Relay barrel;
- keep product-specific variants inside the primitive rather than making callers import several Helm pieces;
- avoid top-level browser work or registrations that execute merely because the module was imported;
- keep optional integrations behind the feature that uses them.

A Relay primitive may legitimately compose more than one Helm primitive when that composition is one product interaction. That is not considered a tree-shaking violation.

## 7. Standalone component imports

Angular standalone `imports` arrays are part of the browser dependency graph.

### Preferred

Import the exact standalone components, directives and pipes used by the template:

```ts
@Component({
  imports: [TranslatePipe, HlmButtonDirective, AppCardComponent],
})
export class ExampleComponent {}
```

### Avoid convenience bundles

Do not introduce arrays that aggregate a large part of the component system for broad reuse:

```ts
// Prohibited for product features.
export const ALL_SPARTAN_UI = [
  HlmButtonDirective,
  HlmCheckboxComponent,
  HlmComboboxComponent,
  HlmDialogComponent,
  HlmPopoverComponent,
];
```

A shared import bundle obscures which interaction capabilities each standalone component actually owns and can make accidental bundle growth harder to review.

Angular built-ins that are genuinely used across one component are not affected by this rule.

## 8. Route-level code splitting

The existing standalone lazy-routing model is part of the Spartan tree-shaking policy.

Non-critical feature routes should continue to use `loadComponent` or `loadChildren` so a feature-specific Spartan primitive does not enter the initial browser graph merely because the feature exists.

Preferred:

```ts
{
  path: 'feature',
  loadComponent: () =>
    import('./feature/feature.component').then((m) => m.FeatureComponent),
}
```

Avoid eagerly importing a route component into the app-shell route table when it can remain lazy.

A shared shell primitive that is visible on initial navigation may correctly stay in the initial graph.

## 9. Provider scope

Tree-shaking applies to providers as well as components.

Feature-specific services, overlay helpers or optional integration providers should be scoped as narrowly as the architecture permits.

Do not move a provider into application bootstrap solely because several routes might eventually use it. Root scope is appropriate only when the service is truly application-wide or when Angular's provided-in-root semantics are the deliberate canonical contract.

Do not add module import side effects that register global listeners, CSS, providers or browser APIs just because a Spartan primitive module is evaluated.

## 10. Side-effect policy

Repository-owned Helm and Relay entry points must be side-effect free at module evaluation time except for standard Angular declarations/metadata.

Prohibited examples include:

- attaching `window` or `document` listeners at top level;
- mutating global theme state at import time;
- registering feature analytics at import time;
- changing locale/direction at import time;
- importing a stylesheet solely for a primitive when Relay/Tailwind ownership already supplies the styling contract;
- eagerly constructing optional SDK clients at module scope.

Runtime setup belongs in Angular lifecycle, providers or explicit application bootstrap where ownership is visible.

## 11. Generated primitive lifecycle

A generated Helm primitive is repository source and must be treated as owned code.

### Adding a primitive

Before generating a new primitive:

1. confirm the interaction is not already covered by Relay or an installed Helm primitive;
2. confirm a native control is not the more appropriate boundary;
3. generate only the required primitive;
4. retain precise Brain subpath imports;
5. add a primitive-specific TypeScript alias if one is required;
6. update `frontend/src/app/components/ui/README.md`;
7. run Spartan health and repository UI governance checks;
8. verify the production build and bundle budget.

### Removing a primitive

When the final consumer of a generated primitive is removed:

1. search product, Relay, tests, previews and tooling for all references;
2. remove the unused generated directory only when there are no runtime consumers;
3. remove its TypeScript alias;
4. update the owned Helm README;
5. run the full frontend verification gate.

Do not keep unused generated primitives indefinitely as a speculative catalogue.

A primitive may remain when it is intentionally retained for an active migration stage, but that exception should be documented in the relevant issue or audit.

## 12. Dynamic imports and optional UI

Dynamic imports are appropriate at a real feature or capability boundary, not as a substitute for normal component composition.

Good candidates include:

- a non-critical route;
- a heavy editor, chart, media or device capability used by a minority of sessions;
- an optional provider SDK that can be loaded after explicit user intent.

Poor candidates include:

- the core button directive;
- the dialog accessibility state machine once the dialog has already opened;
- focus management required for initial rendering;
- code needed synchronously to preserve keyboard or screen-reader semantics.

Performance work must never create an accessibility race where visual content appears before its interaction semantics are available.

## 13. Theme and accent contract

Tree-shaking must not create separate JavaScript component graphs for light and dark themes.

Light/dark presentation and the per-user primary accent remain Relay token concerns. A component should use the same semantic interaction implementation in every theme.

Prohibited:

```ts
if (theme === 'dark') {
  await import('./dark-dialog');
} else {
  await import('./light-dialog');
}
```

Preferred:

```html
<section class="bg-surface text-text-primary">
  ...
</section>
```

with the same Spartan interaction primitive in both theme states.

Theme-specific preview coverage may exist, but theme parity must not duplicate runtime interaction code.

## 14. Accessibility contract

Accessibility behaviour is not optional payload.

Do not defer or conditionally omit:

- focus management required by a dialog or popover;
- keyboard selection behaviour;
- accessible names and relationships;
- disabled/busy state ownership;
- screen-reader announcements needed for the active interaction;
- reduced-motion handling required by the current UI contract.

If tree-shaking removes a primitive, all required accessibility semantics must be supplied by the replacement boundary before the old primitive is removed.

A smaller bundle that regresses keyboard, screen-reader, touch or high-zoom behaviour is a failed migration.

## 15. Localisation and RTL contract

Tree-shaking must be locale-neutral.

Do not create language-specific component imports or separate LTR/RTL interaction implementations. The same component graph should render supported scripts and directionality through translated content, `lang`/`dir` state, and logical CSS.

Locale-specific data files may be lazy when the i18n architecture explicitly supports it, but Spartan interaction code must not be duplicated per locale.

## 16. SSR and hydration

Browser tree-shaking and server rendering share source code but produce different build graphs.

Rules:

- do not make a browser-only Spartan variant just to reduce the server bundle;
- do not import browser APIs at module evaluation time;
- preserve deterministic server/client component ownership;
- keep feature routes lazy where compatible with the existing SSR rendering policy;
- verify that optional browser integrations do not leak into server bootstrap through broad barrels.

The initial browser bundle remains the primary user-download budget. Server bundle size is still worth controlling because broad imports increase cold-start and deployment cost, but it must not be optimised by creating hydration mismatches.

## 17. Migration examples

### 17.1 Direct Brain feature import

Before:

```ts
import { BrnDialog } from '@spartan-ng/brain/dialog';

@Component({ imports: [BrnDialog] })
export class CorrectionModalComponent {}
```

After:

```ts
import { HlmDialogComponent } from '@spartan-ng/helm/dialog';

@Component({ imports: [HlmDialogComponent] })
export class CorrectionModalComponent {}
```

Use a Relay dialog composition instead when the product already owns one.

### 17.2 Broad UI barrel

Before:

```ts
import {
  HlmButtonDirective,
  HlmCheckboxComponent,
  HlmDialogComponent,
  HlmPopoverComponent,
} from '@spartan-ng/helm';
```

After:

```ts
import { HlmButtonDirective } from '@spartan-ng/helm/button';
import { HlmDialogComponent } from '@spartan-ng/helm/dialog';
```

Only import checkbox or popover when the component actually renders those interactions.

### 17.3 Eager route

Before:

```ts
import { SettingsComponent } from './pages/settings/settings.component';

export const routes = [{ path: 'settings', component: SettingsComponent }];
```

After:

```ts
export const routes = [
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
];
```

### 17.4 Theme-specific implementation

Before:

```ts
const dialog = isDark ? DarkDialogComponent : LightDialogComponent;
```

After:

```ts
const dialog = DialogComponent;
```

Use Relay semantic tokens for theme presentation.

## 18. Prohibited patterns

New code must not introduce:

- imports from the root `@spartan-ng/brain` package;
- wildcard namespace imports from Spartan packages;
- direct Brain imports outside the repository-owned Helm layer;
- a root `@spartan-ng/helm` convenience barrel;
- feature imports from deep relative paths inside `components/ui/*/src/lib`;
- a global array containing every Helm or Relay primitive for reuse in standalone `imports`;
- module-level side effects in Helm/Relay entry points;
- theme-specific, locale-specific or direction-specific duplicate Spartan implementations;
- eager route imports solely for convenience;
- global providers for feature-only UI capabilities without an architecture reason;
- speculative generated primitives with no product or migration consumer;
- weakening Angular bundle budgets to accommodate a Spartan migration;
- replacing a Relay product boundary with direct Brain imports because it appears smaller;
- dynamic loading of interaction semantics after visually interactive UI becomes available.

## 19. Allowed patterns

The following are explicitly allowed:

- a primitive-specific Helm barrel that exports the related pieces required to compose one capability;
- multiple Brain imports inside a generated Helm primitive when that capability genuinely requires them;
- a Relay composite that uses several Helm primitives to implement one reusable product interaction;
- application-wide providers whose responsibility is genuinely global;
- route-shell Spartan primitives in the initial bundle when the shell renders them on initial navigation;
- dynamic imports for optional heavy features after an appropriate feature boundary;
- temporarily retained generated primitives when an active migration issue documents the reason.

## 20. Review checklist

For every PR that adds, removes or materially changes Spartan usage, reviewers should verify:

1. Is there an existing Relay primitive that should own this interaction?
2. Is the Helm import primitive-specific?
3. Does feature code avoid direct Brain imports?
4. Did the change add a broad barrel or wildcard import?
5. Did a lazy route become eager?
6. Did a feature-only provider move to global scope?
7. Did module evaluation gain a side effect?
8. Did the change add a generated primitive with no runtime consumer?
9. Are light/dark, RTL and accessibility semantics implemented by the same interaction graph?
10. Does the production build remain within the existing bundle budget?
11. If a primitive was removed, were all consumers and accessibility semantics migrated first?
12. Does the change preserve SSR/hydration compatibility?

## 21. Verification today

Current repository verification already covers important parts of this standard:

```bash
cd frontend
npm run check:spartan-health
npm run lint:check
npm run build
npm run test -- --watch=false
```

Repository-level Spartan boundary checks also reject feature-level Brain imports and other ownership regressions.

The production `npm run build` is required because Angular's configured initial bundle budget is the authoritative coarse size guard.

For documentation-only changes to this policy, canonical repository CI is sufficient; no design preview changes are required because this document does not change a visual contract.

## 22. Required automated guard for `[Spartan UI 0068]`

The follow-up migration verification ticket should add the smallest stable structural check rather than depend on brittle generated chunk names.

Recommended command:

```bash
cd frontend
npm run check:spartan-tree-shaking
```

Recommended checks:

1. reject root `@spartan-ng/brain` imports;
2. reject wildcard Spartan imports;
3. preserve the existing rule that Brain imports outside `components/ui/` are forbidden;
4. reject root `@spartan-ng/helm` imports;
5. reject deep relative imports into generated Helm implementation files from product code;
6. reject a catch-all `@spartan-ng/helm` TypeScript path alias;
7. verify every configured Helm alias maps to one owned primitive directory;
8. flag new product-facing shared arrays that aggregate unrelated Helm primitives;
9. verify production build budgets with the existing `npm run build` step;
10. run representative light/dark and accessibility regression coverage through the existing UI test/design contracts rather than adding theme-specific tree-shaking code.

The guard should be migration-safe. Existing debt that is unrelated to the changed files should not force an unsafe bulk rewrite, except for strict architectural boundaries that are already clean across the entire tree.

The check should print actionable file paths and explain which precise import boundary to use.

## 23. Expected failure modes

Examples of useful automated failures:

```text
Tree-shaking contract failed: src/app/example.ts imports @spartan-ng/brain/dialog outside components/ui. Use the owned Helm/Relay boundary.
```

```text
Tree-shaking contract failed: src/app/example.ts imports the @spartan-ng/helm root. Import @spartan-ng/helm/<primitive> instead.
```

```text
Tree-shaking contract failed: tsconfig.json defines a catch-all @spartan-ng/helm alias. Keep primitive-specific aliases only.
```

A production build that exceeds the configured Angular budget should continue to fail through Angular's normal budget diagnostics. Do not duplicate that threshold in a second script.

## 24. Design-preview policy

Tree-shaking policy does not itself change visual output. Architecture-only changes therefore do not require a new Claude Design or HTML preview state.

When an implementation migration changes which primitive owns a visible interaction, the normal design-sync rules still apply. That PR must update the mapped design preview if its visual or interaction contract changes.

Light/dark, mobile/wider, RTL and high-zoom coverage remain product-quality requirements independent from how JavaScript is split into chunks.

## 25. Security and privacy

Tree-shaking is not a security boundary.

Do not condition authorization, privacy or entitlement enforcement on whether a client bundle contains a component. The backend remains authoritative for permissions and sensitive data.

Bundle optimisation should nevertheless avoid needlessly shipping optional provider SDK code, diagnostic integrations or feature metadata to users who never enter the relevant feature, when the existing architecture provides a clean lazy boundary.

Do not place secrets or privileged configuration in a dynamically imported module. Client-side code is public regardless of which chunk contains it.

## 26. Observability

Bundle regressions should be diagnosed from build output and stable repository checks, not from user identifiers or runtime interaction telemetry.

If future CI records bundle metrics, retain only build artifact sizes/chunk identifiers needed for engineering analysis. No account, language-learning content or user interaction data is required for this policy.

## 27. Rollout

Architecture rollout is incremental:

1. keep current precise Helm aliases and Brain ownership enforcement;
2. apply this policy to all new Spartan/Relay work immediately;
3. add the migration guard in #5534;
4. remediate any newly discovered broad import patterns in focused PRs;
5. remove orphaned Helm primitives only after proving zero consumers;
6. continue enforcing Angular's production bundle budget;
7. use normal design-sync and accessibility verification when a migration changes behavior or presentation.

No runtime rollout flag is required for this architecture document.

## 28. Rollback

This document can be reverted independently because it changes no runtime code, route, API, schema or persisted state.

Implementation changes made under this policy should be reverted at the smallest ownership boundary. Do not restore a broad Spartan barrel, direct feature-level Brain imports, or eager feature routing as a rollback shortcut.

If a tree-shaking optimisation causes accessibility, SSR/hydration, theme, RTL or functional regressions, revert that optimisation and preserve the previous correct interaction contract while a narrower approach is designed.

## 29. Decision summary

The canonical policy is:

- Relay remains the product-facing API;
- repository-owned Helm remains the styling/composition boundary;
- Brain stays behind Helm and uses precise primitive subpaths;
- product code imports primitive-specific Helm entry points only;
- no root Spartan barrels or wildcard imports;
- standalone component imports remain precise;
- non-critical routes stay lazy;
- module entry points stay free of incidental side effects;
- unused generated primitives are removed deliberately, not retained as a speculative catalogue;
- bundle-size budgets are not weakened to make migrations pass;
- light/dark, RTL, localisation, accessibility and SSR/hydration correctness are invariant across the same interaction graph;
- #5534 should enforce these structural rules while Angular's production build remains the authoritative size budget.

This resolves the architecture-standard scope of `[Spartan UI 0067]` and provides the target contract for `[Spartan UI 0068]`.