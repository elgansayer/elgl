# AGENTS.md (The Engineering Constitution)

## 1. Technology Stack

- **Frontend:** Angular (latest stable), Tailwind CSS.
- **Backend:** NestJS (TypeScript).
- **DB/Auth:** Supabase (PostgreSQL, PostGIS, `pg_trgm`).
- **Messaging:** Centrifugo (JWT) + Redis.
- **Audio/Video:** LiveKit (WebRTC SFU).
- **Media Hosting:** Cloudflare R2.
- **Language Processing:** NLP.js.

## 2. Formatting & Linguistic

- **British English:** Must use British spelling (e.g., `colour`).
- **No Em Dashes:** Use standard hyphens or colons.

## 3. Globalisation & RTL Layout

- **Tokenisation:** Use native `Intl.Segmenter`. No regex/split.
- **RTL CSS:** Use Tailwind logical properties (`ps-4`, `border-s`). No physical (`pl-4`, `border-l`).
- **Zero Hard-Coded Strings:** Use `TranslatePipe` (`{{ 'key' | t }}`) in HTML, `I18nService.translate('key', params)` in TS. No raw text. 

## 4. Autonomous Execution

- **Verification:** Run `npm run lint` and `npm test` before completing tasks. Update unit/E2E tests (`*.spec.ts`, `*.e2e-spec.ts`).
- **API First:** Angular never connects to DB directly. Use NestJS API or Centrifugo.
- **No Failing Builds:** PRs must pass `npm run build && npm test`. Fix failures before merge. No follow-up fix PRs.
  - No conflict markers committed.
  - Use squash merges (`--squash --delete-branch`). No `gh pr merge --admin`.
  - Verify dependencies exist before wiring.
  - No duplicate files/components. Search first.
- **Check Overlaps:** Read issues and `git log` before starting to avoid duplicating work.

## 5. Angular Modern Patterns

Hard bans. Violations cause CI failure.

### 5.1 Decorators
- **NEVER** `@Input()`, `@Output()`, `@ViewChild()`, `@ContentChild()`, `@HostBinding()`, `@HostListener()`. Use signal equivalents.
- **NEVER** `@NgModule` or `@Module`. Use standalone components.

### 5.2 Signals
- Use `signal<T>`, `computed<T>`, `input<T>`, `output<T>`, `linkedSignal<T>`, `viewChild()`.
- **`effect()`** only for non-declarative side effects.
- **`toSignal()`** for Observables. No `.subscribe()`.
- **`resource()`** for async data. No `.subscribe()`, `Promise.then()`, or lifecycle hooks for data.

### 5.3 Lifecycle Hooks
- **NEVER** `ngOnChanges()` -> use `effect()` or `computed()`.
- **NEVER** `ngOnInit()` for data -> use `resource()`.
- **NEVER** `ngOnDestroy()` for subs -> use `takeUntilDestroyed()`, `resource()`, `toSignal()`.
- **NEVER** `ngAfterViewInit()` -> use `afterNextRender()`.
- *Exception:* Third-party setup (LiveKit, Centrifugo) allows `ngOnInit`/`ngOnDestroy`.

### 5.4 Async Patterns
- **NEVER** `.subscribe()` -> use `toSignal()`, `resource()`, or `async` pipe.
- **NEVER** `Subject` / `BehaviorSubject` -> use `signal<T>()`.
- **NEVER** `Observable<T>` in service returns -> use `Signal<T>` or `Promise<T>`.
- **NEVER** `setTimeout` / `setInterval` -> use polling `resource()` or `toSignal(interval())`.
- **NEVER** `.toPromise()` -> use `firstValueFrom()`.
- **NEVER** import from `rxjs/operators`.

### 5.5 Templates
- **NEVER** `*ngIf`, `*ngFor`, `*ngSwitch` -> use `@if`, `@for`, `@switch`.
- **NEVER** `[ngClass]`, `[ngStyle]` -> use `[class.foo]`, `[style.prop]`.
- **NEVER** `trackBy` -> use `track`.
- **NEVER** physical CSS (`pl-`, `left-`) -> use logical (`ps-`, `start-`).
- Use `NgOptimizedImage`.

### 5.6 Metadata
- Default `standalone: true` and `changeDetection: OnPush`. Do not set explicitly.
- Use `host` property, not `@HostBinding`.

### 5.7 DI
- Use `inject()`. **NEVER** constructor injection.
- Use `providedIn: 'root'`. No `@Component.providers` unless scoped.

### 5.8 TypeScript
- **NEVER** `any` -> use `unknown`.
- **NEVER** `as` assertions in production -> use type guards or Zod. Valid in tests.
- **NEVER** `console.log`. Use logging service.

### 5.9 Accessibility
- Pass AXE checks, follow WCAG AA.

## 6. UI Evolution & Design

- **Design System:** Mobile-first, strict dark mode (`#121212`), neon accents. No generic styles.
- **Responsive:** Support tablet/desktop with unique layouts.
- **Zero hard-coded strings:** Pipe via `TranslatePipe`.
- **Template control flow:** Only `@if`, `@for`, `@switch`.
- **Stable tracking:** `@for` must use stable keys (`track item.id`).
- **Primitives first:** Reuse components (`app-card`, etc.) before ad-hoc utilities.
- **Tokens:** Use Tailwind/app tokens (surface, radius, etc.).
- **RTL-safe:** Logical spacing/borders only.
- **Formatting:** Ensure UI prices format properly.
- **Discovery UX:** Use `Find partners` model. No free-text search; use compact controls.
- **Gate:** Pass `npm run check:control-flow`, `build`, `test`, `check:rtl-logical`, `lint` before completion.

## 7. Testing

- **Visit Tests:** Always review `*.spec.ts` / `*.e2e-spec.ts` when touching code.
- **UI Coverage:** All primitives need tests (reactivity, a11y, RTL).
- **API Coverage:** NestJS needs Vitest suites (DTOs, auth, mocks, queries).
- **Verification:** Run `npm test` immediately after changes.

## 8. Audit Findings (2026-07-29)

### 8.1 Critical (Fixed)
- Stripe webhooks secured.
- VIP upgrade endpoint secured.
- Unlimited coins exploit fixed.
- Apple/Google webhooks secured.

### 8.2 High (Fixed)
- AI endpoints use real APIs (DeepL, Azure).

### 8.3 Frontend Type Safety (In Progress)
- 73 `as` assertions to migrate.
- `console.log` instances removed.
- `any` type banned.

### 8.4 Verified healthy
- Clean builds.
- 1828 frontend, 2754 backend tests passing.
- Constitution/lint scripts pass.
- APIs integrated.

### 8.5 UI Audit (Pending)
- Discovery/chat UI needs dark theme parity with HelloTalk.
- `.env.example` missing config variables.

## 9. Skills System

Use Agent Skills (`.agents/skills/<name>/SKILL.md`) for recurring tasks:
- `nestjs-feature-module`, `angular-feature-component`, `supabase-migration`, `payment-webhook-security`, `realtime-centrifugo-channel`, `livekit-room-flow`.

## 10. Strict Quality Rules (2026-07-23)

- **Design Consistency:** Strict adherence to established mobile-first aesthetic.
- **No Dead Buttons:** All buttons must work or show "Not Implemented" toast.
- **Test Mandate:** Tests required for all new features.
- **No Deprecated Packages:** Verify dependencies.
- **Fake Data First:** Use mock seed data, never render empty states indefinitely.
- **NEVER Hardcode:** All dynamic state flows from backend/store/translations. Fallback to `mock-data.ts`.
- **Aggressive Idea Stealing:** Emulate mechanics from HelloTalk, Instagram, Discord, etc.
