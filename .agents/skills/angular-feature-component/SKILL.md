---
name: angular-feature-component
description: "Scaffold a new standalone Angular component under frontend/src/app/components following this project's clone-first, signals, i18n, RTL and accessibility rules. Use when adding a new UI component, page, modal, or feature surface to the HelloTalk clone frontend."
---

# Angular Feature Component

## When to Use

- Adding a new page-level or reusable component under `frontend/src/app/components/`.
- Building a new modal, dashboard, or feed surface.

## File Layout (mirror existing components, e.g. `frontend/src/app/components/profile/`)

```
frontend/src/app/components/<feature>/
├── <feature>.component.ts
├── <feature>.component.html
├── <feature>.component.scss
└── <feature>.component.spec.ts
```

## Component Decorator Rules (strict - these are audited)

```typescript
@Component({
  selector: 'app-<feature>', // kebab-case, 'app' prefix - enforced by eslint
  imports: [CommonModule, TranslatePipe /* + whatever else is used */],
  templateUrl: './<feature>.component.html',
  styleUrls: ['./<feature>.component.scss'],
})
export class FeatureComponent {}
```

- Do **NOT** add `standalone: true` - it is the default in Angular v20+ and is explicitly banned in `AGENTS.md`/`copilot-instructions.md`. (This codebase had 22 violations found and fixed in the 2026-07-22 audit - do not reintroduce them.)
- Do **NOT** add `changeDetection: ChangeDetectionStrategy.OnPush` - default in Angular v22+.
- Use `inject()` for all dependencies (`private userService = inject(UserService)`), never constructor injection.
- Prefer `signal()` / `computed()` for all component state; never call `.mutate()` on a signal, use `.set()`/`.update()`.
- Use `input.required<T>()` / `input<T>(default)` functions for all component inputs. NEVER `@Input()` decorator.
- Use `output<T>()` functions for all component outputs. NEVER `@Output()` decorator or `EventEmitter` (do not import `EventEmitter` at all).
- Use `viewChild()` / `viewChildren()` signal queries for template elements. NEVER `@ViewChild()` / `@ViewChildren()`.
- Use `resource<T>({ loader, request })` for ALL async data fetching. NEVER `.subscribe()`, `Promise.then()`, or `ngOnInit()` for data loading.
- Use `toSignal(observable)` to convert Observables to signals. NEVER `.subscribe()` and manually call `.set()`.
- Use `effect(() => { ... })` ONLY for side effects that cannot be expressed declaratively. NEVER `effect()` for state derivation (use `computed()`).
- NEVER `ngOnChanges()`, `ngAfterViewInit()`. NEVER `ngOnInit()` for data loading. NEVER `ngOnDestroy()` for subscription cleanup - use `takeUntilDestroyed()` / `DestroyRef`.
- NEVER `Subject` / `BehaviorSubject` for state - use `signal<T>()` instead.
- NEVER `setTimeout` / `setInterval` for state or async work - use `resource()` with polling or `interval()` from rxjs + `toSignal()`.
- NEVER import from `rxjs/operators` - all operators are exported from `rxjs` directly.

## Template Rules (strict - enforced by `npm run check:*` scripts in `frontend/`)

- Native control flow only: `@if`, `@for (x of xs(); track x.id)`, `@switch`. Never `*ngIf`/`*ngFor`/`*ngSwitch`.
- Never `[ngClass]`/`[ngStyle]` - use `[class.foo]="cond()"` / `[style.prop]="value()"`.
- Never a hard-coded physical direction Tailwind class (`pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `border-l`, `border-r`, `text-left`, `text-right`). Always use logical equivalents: `ps-`/`pe-`, `ms-`/`me-`, `border-s`/`border-e`, `text-start`/`text-end`.
- Reuse shared primitives from `frontend/src/app/components/primitives/` (`app-card`, `app-button-primary`, `app-button-secondary`, `app-input`, `app-textarea`, `app-chip`, `app-pill`, `app-empty-state`) before inventing new markup.

## Zero Hard-Coded Strings (mandatory)

Every piece of user-facing text goes through `TranslatePipe`:

```html
<button>{{ 'profile.saveButton' | t }}</button>
<p>{{ 'moments.likeCount' | t: { count: likeCount() } }}</p>
```

Add the corresponding keys to the dictionary in `frontend/src/app/services/i18n.service.ts` (`baseDictionary`). For programmatic (non-template) text, inject `I18nService` and call `this.i18n.translate('key', params)` - see `frontend/src/app/services/translate.pipe.ts` for the pipe implementation this wraps. See the `i18n-translation-workflow` skill for the full key-addition procedure.

## Accessibility

Every new interactive component must pass AXE checks and WCAG AA: visible focus states, sufficient colour contrast, correct ARIA roles/labels on custom controls (chips, pills, modals need `role`, `aria-modal`, `aria-label` as appropriate).

## Tests

Every component needs a `*.component.spec.ts` using `TestBed.configureTestingModule` with real or mocked signal-based service dependencies (see `audio-sync-reader.component.spec.ts` for a pattern using `Partial<Store>` mocks with `signal()` values). Cover: component creation, key signal-driven behaviour, and any `output()` emissions.

**vi.fn() constructor gotcha:** when mocking a browser API that's invoked with `new` (e.g. `SpeechSynthesisUtterance`), `vi.fn().mockImplementation(() => obj)` with an arrow function will throw `TypeError: ... is not a constructor` at runtime. Use a `function` expression instead: `vi.fn().mockImplementation(function (this: Record<string, unknown>) { return this; })`.

## Verification

Run the `verification-gate` skill's frontend steps before considering the component done.
