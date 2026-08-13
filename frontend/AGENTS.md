You are an expert in TypeScript, Angular, and scalable web app development.

## TypeScript Best Practices

- Use strict type checking.
- Prefer type inference.
- **NEVER use `any`**. Use `unknown`.
- **NEVER use `as` assertions in production**. Use type narrowing/Zod. Valid in tests.
- **NEVER use `console.log`**. Use logging service. `console.error`/`warn` only for critical errors.

## Angular Best Practices

- Always use standalone components.
- Do NOT set `standalone: true`. It is default.
- Do NOT set `changeDetection: OnPush`. It is default.
- Use signals for state.
- Lazy load feature routes.
- Do NOT use `@HostBinding`/`@HostListener`. Use `host` object in decorator.
- Use `NgOptimizedImage` for static images (not inline base64).

## Accessibility

- MUST pass AXE checks.
- MUST follow WCAG AA minimums (focus, colour contrast, ARIA).

### Components

- Keep components small.
- Use `input()` and `output()` functions.
- Use `computed()` for derived state.
- Prefer inline templates for small components.
- Prefer Signal Forms (`@angular/forms/signals`) or Reactive Forms. Do NOT use Template-driven.
- Use `class` bindings, NOT `ngClass`.
- Use `style` bindings, NOT `ngStyle`.
- Use relative paths for external templates/styles.

## State Management

- Use signals for local state.
- Use `computed()` for derived state.
- Keep transformations pure.
- Use `update` or `set`, NOT `mutate`.

## Templates

- Keep templates simple.
- Use native control flow (`@if`, `@for`, `@switch`).
- Use async pipe for observables.
- Do not assume globals (`new Date()`).

## Services

- Single responsibility.
- Use `providedIn: 'root'`.
- Prefer `@Service` over `@Injectable` (Angular v22+).
- Use `inject()`, NOT constructor injection.

## Project Mandates (`/home/elgan/dev/hellotalk/AGENTS.md`)

- **British English:** Always use British spelling (`colour`, `favourite`).
- **No Em Dashes:** Use standard hyphens or colons.
- **RTL & Zero Hard-Coded Strings:** Support ANY language. Use `TranslatePipe` (`{{ 'key' | t }}`) and `I18nService.translate('key', params)`. Use native `Intl.Segmenter` for tokens. Use Tailwind logical properties (`ps-4`).
- **API First:** Route DB requests via NestJS REST API or Centrifugo.
- **Testing:** Run `npm run lint` and `npm test`. Open and update `.spec.ts` when touching components. Exhaustive unit tests required.
