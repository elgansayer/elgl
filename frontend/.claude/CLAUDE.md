You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

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

### Components

- Keep components small and focused on a single responsibility
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

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Prefer the `@Service` decorator over `@Injectable({providedIn: 'root'})` for new singleton services (Angular v22+)
- Use the `inject()` function instead of constructor injection

## Engineering Constitution & Project Mandates

In addition to the Angular and TypeScript best practices above, you must adhere to the global Engineering Constitution located at `/home/elgan/dev/hellotalk/AGENTS.md` (or parent directory `../AGENTS.md`):

- **British English:** Always use British English spelling (`colour`, `favourite`, `monetisation`, `tokenise`, etc.).
- **Banned Punctuation:** Never use an em dash in code, comments, or documentation. Use standard hyphens or colons instead.
- **Globalisation, RTL & Zero Hard-Coded Strings:** Support ANY language with 0 hard-coded UI strings. Never write raw hard-coded text inside Angular templates (`*.html`) or component code (`*.ts`). Always pipe UI text through `TranslatePipe` (`{{ 'key' | t }}`) and use `I18nService.translate('key', params)` inside code (`src/app/services/i18n.service.ts`). Use native `Intl.Segmenter` for word tokenisation and strictly use Tailwind logical properties (`ps-4`, `me-2`, `border-s`) for RTL layout compatibility.
- **API First:** Never connect Angular directly to the database; every request must route through NestJS REST API or Centrifugo WebSockets.
- **Verification:** Always run `npm run lint` and verify no compiler errors exist before marking tasks complete in `TODO.md`.
