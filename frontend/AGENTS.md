You are an expert in TypeScript, Angular, Spartan UI, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular, TypeScript, Spartan, and project best practices.

This file is the supreme authority on Angular coding style for this project - zero tolerance for the
legacy patterns below, hard bans with zero exceptions unless a rule is mechanically enforced, protects
credentials/user data/production availability, or current task evidence justifies a scoped, documented
departure. Violations of the decorator/lifecycle/async bans in this file cause CI/build failure.

## Spartan UI - Mandatory Default

Spartan UI is the canonical component architecture for frontend UI work.

- Read `../.claude/skills/spartan/SKILL.md` before substantial component, form, overlay, icon, styling, theming, or UI migration work.
- Inspect `components.json` and existing Helm code under `src/app/components/ui` before creating any primitive.
- Before generating or replacing Spartan components, run the appropriate `@spartan-ng/cli:info --json` command and inspect `installedComponents` and `availableComponents`.
- Use Spartan MCP or the current Spartan documentation to confirm selectors, imports, variants, sizes, composition, dependencies, and accessibility. Never guess Spartan APIs.
- Prefer existing Helm components and documented Spartan composition over ad hoc HTML/Tailwind primitives. Do not hand-roll focus traps, roving tabindex, combobox/listbox/menu keyboard state, or dialog Escape/backdrop behaviour when an approved Spartan primitive exists.
- Add missing components through `@spartan-ng/cli:ui`. Do not recreate generated components from memory.
- Use Helm by default. Brain owns headless behaviour/accessibility and must not be forked or edited.
- Prefer built-in component variants and sizes before call-site class overrides. Product-wide styling belongs in owned Helm code or shared Relay tokens - never invent one-off colours, surfaces, radii, shadows, or motion values when a semantic role already exists.
- Use Spartan Field composition for forms and documented Spartan overlay composition for dialogs, sheets, popovers, menus, and tooltips.
- Use the existing `@ng-icons/core` + Lucide stack for generic vector UI icons and register icons with `provideIcons`.
- After broad Spartan migrations or package upgrades, run the Spartan healthcheck in addition to project verification.

Project-specific guidance is generally stricter than generic Spartan examples. `../DESIGN.md`, Relay semantic
tokens, light/dark parity, per-user primary accent behaviour, RTL, i18n, reduced motion, forced colours, high
zoom, screen-reader support, and WCAG AA are the preferred project defaults unless current task evidence or an
explicit decision justifies updating them. `docs/spartan-relay-architecture.md` defines the ownership boundary
between feature code, Relay tokens, Spartan Helm, and Brain. For material UI work, also follow
`../docs/claude-design-two-way-sync.md`: Claude Design is the editable design-intent/review workspace; runtime
Angular code, Relay tokens, Spartan contracts, and automated tests remain authoritative for shipped software.

## Decorator Bans (NEVER use these)

- **NEVER `@Input()`** - use `input.required<T>()` or `input<T>(default)`.
- **NEVER `@Output()`** - use `output<T>()`.
- **NEVER `@ViewChild()` / `@ViewChildren()`** - use `viewChild()` / `viewChildren()` signal queries.
- **NEVER `@ContentChild()` / `@ContentChildren()`** - use `contentChild()` / `contentChildren()` signal queries.
- **NEVER `@HostBinding()` / `@HostListener()`** - use the `host: { ... }` property in `@Component()` / `@Directive()`.
- **NEVER `@NgModule` or `@Module`** - every component is standalone (the default since Angular v20).

## Lifecycle Hook Bans & Replacements

- **NEVER `ngOnChanges()`** - use `effect()` reacting to `input()` signals, or derive via `computed()`.
- **NEVER `ngOnInit()` for data loading** - use `resource()` with the `loader` function.
- **NEVER `ngOnDestroy()` for subscription cleanup** - use `takeUntilDestroyed()` or `DestroyRef`; `resource()`/`toSignal()` auto-cleanup and need neither.
- **NEVER `ngAfterViewInit()`** - use `afterNextRender()` or `afterRender()` for DOM-dependent side effects.

Limited exception: `ngOnInit`/`ngOnDestroy` are allowed only when integrating a non-reactive third-party library
that requires imperative setup/teardown (LiveKit room connection, Centrifugo subscription). Document the
exception with a comment.

## Async Pattern Bans

- **NEVER `.subscribe()`** - use `toSignal()`, `resource()`, or the `async` pipe in templates.
- **NEVER `Subject` / `BehaviorSubject` for state** - use `signal<T>()`.
- **NEVER `Observable<T>` as a service return type** - expose `Signal<T>` (via `toSignal()`) or `Promise<T>`.
- **NEVER `setTimeout` / `setInterval` for state or async work** - use `resource()` with a polling `loader`, or `interval()` from rxjs converted via `toSignal()`.
- **NEVER `.toPromise()`** (deprecated) - use `firstValueFrom()` or `lastValueFrom()`.
- **NEVER import from `rxjs/operators`** - operators are exported from `rxjs` directly.

## TypeScript Best Practices

- Use strict type checking; prefer type inference where obvious, don't annotate types the compiler can infer.
- **NEVER use the `any` type** - hard ban. Use `unknown` when type is uncertain.
- **NEVER use type assertions (casting) via `as`** - hard ban in production code. Use type narrowing, type guards, or Zod/schema validation instead. Casting is only permitted in test files (`*.spec.ts`) for mock setup.
- **NEVER use `console.log`** - hard ban. Use a proper logging service or error reporting mechanism. `console.error`/`console.warn` are permitted for critical error reporting only.

## Angular Component Metadata & DI

- Always use standalone components (default since Angular v20) - never `standalone: true`.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly - it is the default since Angular v22.
- Do NOT set `host: { '[class]': ... }` inside `@Component` unless needed for component-specific host classes.
- Always use the `inject()` function: `private userService = inject(UserService)`. Constructor injection (`constructor(private userService: UserService) {}`) is banned.
- Use `providedIn: 'root'` for services (prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` since Angular v22). Do NOT register a service in `@Component.providers` unless intentionally component-scoped.
- Use `NgOptimizedImage` for all static images (it does not work for inline base64 images).

## Signal State Mandate

All component state, derived state, and prop passing uses signals:

- `signal<T>(initial)` for local reactive state - `.set()` / `.update()`, never `.mutate()`.
- `computed<T>(() => derivation)` for all derived values - never store a derivable value in a separate signal.
- `input.required<T>()` / `input<T>(default)` for every component input.
- `output<T>()` for every component output event (never import `EventEmitter`).
- `linkedSignal<T>({ source, computation })` for writable state linked to a source signal.
- `effect(() => { ... })` only for side effects that cannot be expressed declaratively (syncing to non-Angular APIs, logging) - never for state derivation.
- `viewChild()` / `viewChildren()` for template element queries.
- `toSignal(observable)` to convert Observables to signals.
- `resource<T>({ loader, request })` for all async data fetching.
- Prefer Signal Forms (`@angular/forms/signals`, stable since Angular v22) for new forms; otherwise prefer Reactive forms over Template-driven.

## Templates

- **NEVER** `*ngIf` / `*ngFor` / `*ngSwitch` / `*ngSwitchCase` / `*ngSwitchDefault` - use `@if`, `@for`, `@switch`.
- **NEVER** `[ngClass]` / `[ngStyle]` - use `[class.foo]`, `[style.prop]`.
- **NEVER** `trackBy` functions - use an inline `track` expression; every `@for` needs a stable identity key unless none exists.
- **NEVER** physical direction CSS (`pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `border-l`, `border-r`, `text-left`, `text-right`) - use logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `border-s`, `border-e`, `text-start`, `text-end`). Prefer `gap-*` over `space-*`.
- Keep templates simple, avoid complex logic. Use the async pipe for observables. Do not assume globals like `new Date()` are available.
- Use semantic Relay/Spartan colour roles rather than raw Tailwind palette colours.
- When using external templates/styles, use paths relative to the component TS file; prefer inline templates for small components.

## Accessibility

- Must pass all AXE checks and follow WCAG AA minimums (focus management, colour contrast, ARIA attributes).
- Prefer Spartan Brain behaviour for interaction primitives rather than reimplementing keyboard/focus semantics.

## Product & UX Rules

- **Theme parity:** Light and dark themes are both first-class. Never impose a global dark-only or neon mandate; express product character through Relay semantic roles and approved variants valid across themes, forced colours, reduced motion, and per-user primary accents.
- **Responsive device support:** Mobile-first, but tablet and desktop must be fully supported with deliberate responsive compositions (sidebars, multi-pane layouts, grid adaptations) rather than simply stretching the mobile layout.
- **Discovery UX parity:** The discovery surface follows a "Find partners" model, not a "Nearby"-first model - prioritise partner intent, filter controls, and profile quality over distance framing. Filter controls use compact controls only (segmented buttons, selects, toggles, chips, controlled lists), never free-text inputs; language filters must be list-driven and searchable.
- **VIP and monetisation copy:** Ensure any price shown in UI is formatted properly.
- **Completion gate for frontend changes:** before marking frontend work complete, run `npm run check:control-flow`, `npm run build`, `npm run test -- --watch=false`, `npm run check:rtl-logical`, `npm run lint` if present, and the root `npm run check:design-sync` when a mapped visual contract changed.

## State Management

- Use signals for local component state, `computed()` for derived state.
- Keep state transformations pure and predictable.
- Do NOT use `mutate` on signals - use `update` or `set`.

## Services

- Design services around a single responsibility.
- Design lazy loading into feature routes.

## Repository Engineering Guidelines

In addition to the Angular, TypeScript, and Spartan practices above, use the living repository guidelines in the
parent `../AGENTS.md` as strong defaults. They may be updated or adapted when current task requirements, safety,
mechanically enforced checks, and engineering evidence justify doing so:

- **British English:** Always use British English spelling (`colour`, `favourite`, `monetisation`, `tokenise`, etc.).
- **Banned Punctuation:** Never use an em dash in code, comments, or documentation. Use standard hyphens or colons instead.
- **Globalisation, RTL & Zero Hard-Coded Strings:** Support ANY language with 0 hard-coded UI strings. Never write raw hard-coded text inside Angular templates (`*.html`) or component code (`*.ts`). Always pipe UI text through `TranslatePipe` (`{{ 'key' | t }}`) and use `I18nService.translate('key', params)` inside code (`src/app/services/i18n.service.ts`). Use native `Intl.Segmenter` for word tokenisation and strictly use Tailwind logical properties (`ps-4`, `me-2`, `border-s`) for RTL layout compatibility.
- **API First:** Never connect Angular directly to the database; every request must route through NestJS REST API or Centrifugo WebSockets.
- **No dead buttons:** every `<button>`, `<a>`, or clickable element must have a functional `(click)` handler, a valid `[routerLink]`, or trigger a "Not Implemented" toast if the feature is pending.
- **Verification & Test Visiting:** Always run `npm run lint` and `npm test -- --watch=false` and verify no compiler errors or test failures exist before marking tasks complete. Whenever inspecting, adding, or modifying frontend code or components, you must ALWAYS simultaneously open, review, and update/add the associated `.spec.ts` test files. Every UI primitive and feature component must have exhaustive unit tests verifying Signal reactivity, host class bindings, and accessibility.
