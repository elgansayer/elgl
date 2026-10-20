You are an expert in TypeScript, Angular, Spartan UI, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular, TypeScript, Spartan, and project best practices.

## Spartan UI - Mandatory Default

Spartan UI is the canonical component architecture for frontend UI work.

- Read `../.claude/skills/spartan/SKILL.md` before substantial component, form, overlay, icon, styling, theming, or UI migration work.
- Inspect `components.json` and existing Helm code under `src/app/components/ui` before creating any primitive.
- Before generating or replacing Spartan components, run the appropriate `@spartan-ng/cli:info --json` command and inspect `installedComponents` and `availableComponents`.
- Use Spartan MCP or the current Spartan documentation to confirm selectors, imports, variants, sizes, composition, dependencies, and accessibility. Never guess Spartan APIs.
- Prefer existing Helm components and documented Spartan composition over ad hoc HTML/Tailwind primitives.
- Add missing components through `@spartan-ng/cli:ui`. Do not recreate generated components from memory.
- Use Helm by default. Brain owns headless behaviour/accessibility and must not be forked or edited.
- Prefer built-in component variants and sizes before call-site class overrides. Product-wide styling belongs in owned Helm code or shared Relay tokens.
- Use Spartan Field composition for forms and documented Spartan overlay composition for dialogs, sheets, popovers, menus, and tooltips.
- Use the existing `@ng-icons/core` + Lucide stack for generic vector UI icons and register icons with `provideIcons`.
- After broad Spartan migrations or package upgrades, run the Spartan healthcheck in addition to project verification.

Project-specific guidance is generally stricter than generic Spartan examples. `../DESIGN.md`, Relay semantic
tokens, light/dark parity, per-user primary accent behaviour, RTL, i18n, reduced motion, forced colours, high
zoom, screen-reader support, and WCAG AA are the preferred project defaults unless current task evidence or an
explicit decision justifies updating them.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- **NEVER use the `any` type** -- this is a hard ban. Use `unknown` when type is uncertain.
- **NEVER use type assertions (casting) via `as`** -- this is a hard ban in production code. Use proper type narrowing, type guards, or Zod/schema validation instead. Casting is only permitted in test files (`*.spec.ts`) for mock setup.
- **NEVER use `console.log`** -- this is a hard ban. Use a proper logging service or error reporting mechanism. `console.error` and `console.warn` are permitted for critical error reporting only.

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` explicitly. `OnPush` is the default in Angular v22+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, colour contrast, and ARIA attributes.
- Prefer Spartan Brain behaviour for interaction primitives rather than reimplementing keyboard/focus semantics.

### Components

- Keep components small and focused on a single responsibility
- Use existing Spartan/Relay components before creating a new primitive
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Prefer inline templates for small components
- Prefer Signal Forms (`@angular/forms/signals`) for new forms. They are stable in Angular v22+ and provide signal-based state, type-safe field access, and schema-based validation
- When not using Signal Forms, prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Use semantic Relay/Spartan colour roles rather than raw Tailwind palette colours.
- Prefer `gap-*` over `space-*` and logical direction utilities over physical direction utilities.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Repository Engineering Guidelines

In addition to the Angular, TypeScript, and Spartan practices above, use the living repository guidelines in the
parent `../AGENTS.md` as strong defaults. They may be updated or adapted when current task requirements, safety,
mechanically enforced checks, and engineering evidence justify doing so:

- **British English:** Always use British English spelling (`colour`, `favourite`, `monetisation`, `tokenise`, etc.).
- **Banned Punctuation:** Never use an em dash in code, comments, or documentation. Use standard hyphens or colons instead.
- **Globalisation, RTL & Zero Hard-Coded Strings:** Support ANY language with 0 hard-coded UI strings. Never write raw hard-coded text inside Angular templates (`*.html`) or component code (`*.ts`). Always pipe UI text through `TranslatePipe` (`{{ 'key' | t }}`) and use `I18nService.translate('key', params)` inside code (`src/app/services/i18n.service.ts`). Use native `Intl.Segmenter` for word tokenisation and strictly use Tailwind logical properties (`ps-4`, `me-2`, `border-s`) for RTL layout compatibility.
- **API First:** Never connect Angular directly to the database; every request must route through NestJS REST API or Centrifugo WebSockets.
- **Verification & Test Visiting:** Always run `npm run lint` and `npm test -- --watch=false` and verify no compiler errors or test failures exist before marking tasks complete. Whenever inspecting, adding, or modifying frontend code or components, you must ALWAYS simultaneously open, review, and update/add the associated `.spec.ts` test files. Every UI primitive and feature component must have exhaustive unit tests verifying Signal reactivity, host class bindings, and accessibility.
