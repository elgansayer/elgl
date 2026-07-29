# AGENTS.md (The Engineering Constitution)

## 1. Technology Stack Mandate

You are strictly forbidden from substituting these core technologies:

- **Frontend:** Angular (latest stable) using Tailwind CSS.
- **Backend API:** NestJS (TypeScript).
- **Database & Auth:** Supabase (PostgreSQL with PostGIS for spatial queries and `pg_trgm` for search).
- **Real-Time Messaging:** Centrifugo (using JWT authentication) + Redis.
- **Real-Time Audio/Video:** LiveKit (WebRTC SFU architecture).
- **Media Hosting:** Cloudflare R2 (S3-compatible, chosen for zero egress fees).
- **Language Processing:** NLP.js on the backend for language detection.

## 2. Formatting & Linguistic Rules

- **British English:** You must use British English spelling for all variables, database columns, and UI copy (e.g., `colour`, `monetisation`, `tokenise`, `favourite`).
- **Banned Punctuation:** You must never use an em dash in your code, comments, or documentation. Use standard hyphens or colons instead.
- **Monetary Display:** Whenever rendering a price in the UI or documentation, you must display both currencies (e.g., "8 UKP / $10 USD" or "20 UKP / $26 USD").

## 3. Globalisation & RTL Layout Rules

- **Universal Tokenisation:** You must use the native JavaScript `Intl.Segmenter` API (which achieved baseline browser support in 2024) to parse all text into clickable word tokens. Never use regex or space-splitting.
- **RTL CSS:** You must strictly use Tailwind logical properties (e.g., `ps-4`, `me-2`, `border-s`) instead of physical directions (`pl-4`, `mr-2`, `border-l`). This ensures the Angular interface natively mirrors for Arabic, Hebrew, and Persian.
- **Zero Hard-Coded Strings & Universal Translation System:** The application must support ANY language with 0 hard-coded UI strings. Never hard-code user-facing text inside Angular templates (`*.html`) or TypeScript (`*.ts`). All text in component templates MUST use `TranslatePipe` (`{{ 'key' | t }}` or `{{ 'key' | t: { param: value } }}`) imported from `src/app/services/translate.pipe.ts`. All programmatic text inside code MUST use `I18nService.translate('key', params)` injected from `src/app/services/i18n.service.ts`. The `I18nService` manages reactive locale state, document directionality (`dir="rtl"`/`dir="ltr"`), and fallback lookups with dynamic backend translation (`/nlp/translate-ui`).

## 4. Autonomous Execution Protocol

- **Verification & Test Visiting:** Before checking off any task in `TODO.md` or completing any code changes, you must run `npm run lint` and `npm test` (`npm test -- --watch=false` on frontend) and verify no TypeScript compiler errors or failing tests exist. Whenever modifying or adding feature code, you must ALWAYS visit, review, and update/add corresponding unit tests (`*.spec.ts`) and E2E tests (`*.e2e-spec.ts`).
- **API First:** Angular must never connect to the database directly. Every data request must route through the NestJS REST API or Centrifugo WebSockets.

## 5. Angular Modern Patterns (Mandatory - Zero Tolerance for Legacy)

This section is the **supreme authority** on Angular coding style. Every rule below is a hard ban with zero exceptions. Violations will cause CI/build failure.

### 5.1 Decorator Bans (NEVER use these)

- **NEVER `@Input()`** -- use the `input.required<T>()` or `input<T>(default)` signal function.
- **NEVER `@Output()`** -- use the `output<T>()` signal function.
- **NEVER `@ViewChild()` / `@ViewChildren()`** -- use `viewChild()` / `viewChildren()` signal queries.
- **NEVER `@ContentChild()` / `@ContentChildren()`** -- use `contentChild()` / `contentChildren()` signal queries.
- **NEVER `@HostBinding()` / `@HostListener()`** -- use the `host: { ... }` property in `@Component()` / `@Directive()`.
- **NEVER `@NgModule`** -- all components are standalone (default in Angular v20+).

### 5.2 Signal State Mandate

All component state, derived state, and prop passing MUST use signals:

- **`signal<T>(initial)`** for local reactive state. Use `.set()` / `.update()`, never `.mutate()`.
- **`computed<T>(() => derivation)`** for all derived values. Never store derivable values in separate signals.
- **`input.required<T>()`** / **`input<T>(default)`** for all component inputs (props). Never `@Input()`.
- **`output<T>()`** for all component output events. Never `@Output()` + `EventEmitter` (do not import `EventEmitter` at all).
- **`linkedSignal<T>({ source, computation })`** for writable state linked to a source signal.
- **`effect(() => { ... })`** ONLY for side effects that cannot be expressed declaratively (e.g., syncing to non-Angular APIs, logging). Never use `effect()` for state derivation (use `computed()`).
- **`viewChild()` / `viewChildren()`** for template element queries. Returns a signal.
- **`toSignal(observable)`** to convert Observables to signals. Never `.subscribe()` and manually call `.set()`.
- **`resource<T>({ loader, request })`** for ALL async data fetching. Never use `.subscribe()`, `Promise.then()`, or lifecycle hooks for data loading.

### 5.3 Lifecycle Hook Bans & Replacements

- **NEVER `ngOnChanges()`** -- use `effect()` reacting to `input()` signals, or derive via `computed()`.
- **NEVER `ngOnInit()` for data loading** -- use `resource()` with the `loader` function.
- **NEVER `ngOnDestroy()` for subscription cleanup** -- use `takeUntilDestroyed()` or `DestroyRef`; better yet, use `resource()`/`toSignal()` which auto-cleanup.
- **NEVER `ngAfterViewInit()`** -- use `afterNextRender()` or `afterRender()` for DOM-dependent side effects.

Limited exceptions for `ngOnInit`/`ngOnDestroy`: ONLY allowed when integrating with non-reactive third-party libraries that require imperative setup/teardown (e.g., LiveKit room connection, Centrifugo subscription). Document the exception with a comment.

### 5.4 Async Patterns Ban

- **NEVER `.subscribe()`** -- use `toSignal()`, `resource()`, or the `async` pipe in templates.
- **NEVER `Subject` / `BehaviorSubject` for state** -- use `signal<T>()` instead.
- **NEVER `Observable<T>` as service return types** -- services should expose `Signal<T>` (via `toSignal()`) or `Promise<T>`.
- **NEVER `setTimeout` / `setInterval` for state or async work** -- use `resource()` with a polling `loader` or `interval()` from rxjs converted via `toSignal()`.
- **NEVER `.toPromise()`** (deprecated) -- use `firstValueFrom()` or `lastValueFrom()`.
- **NEVER import from `rxjs/operators`** -- all operators are exported from `rxjs` directly.

### 5.5 Template Rules

- **NEVER `*ngIf` / `*ngFor` / `*ngSwitch` / `*ngSwitchCase` / `*ngSwitchDefault`** -- use `@if`, `@for`, `@switch`.
- **NEVER `[ngClass]` / `[ngStyle]`** -- use `[class.foo]`, `[style.prop]`.
- **NEVER `trackBy` functions** -- use inline `track` expressions in `@for`.
- **NEVER physical direction CSS** (`pl-`, `pr-`, `ml-`, `mr-`, `left-`, `right-`, `border-l`, `border-r`, `text-left`, `text-right`) -- use logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`, `border-s`, `border-e`, `text-start`, `text-end`).
- Always use `NgOptimizedImage` for static images.

### 5.6 Decorator Metadata Rules

- Do NOT set `standalone: true` -- it is the default in Angular v20+.
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` -- it is the default in Angular v22+.
- Do NOT set `host: { '[class]': ... }` inside `@Component` unless needed for component-specific host classes. Dynamic host bindings must use the `host` property, never `@HostBinding`.

### 5.7 Dependency Injection

- Always use `inject()` function: `private userService = inject(UserService)`.
- Never use constructor injection: `constructor(private userService: UserService) {}` is banned.
- Use `providedIn: 'root'` for services. Do NOT register services in `@Component.providers` unless they are intentionally scoped.

### 5.8 TypeScript

- Strict type checking: avoid `any`, use `unknown` when uncertain.
- **NEVER use the `any` type** -- this is a hard ban with zero exceptions. Use `unknown` when uncertain.
- **NEVER use type assertions (casting) via `as`** -- this is a hard ban in production code. Use proper type narrowing, type guards, or schema validation (Zod) instead. Type assertions are ONLY permitted in test files (`*.spec.ts`, `*.e2e-spec.ts`) for mock setup stubs.
- **NEVER use `console.log`** -- this is a hard ban. Use a proper logging service or structured error reporting mechanism. `console.error` and `console.warn` are permitted for critical system-error reporting only.
- Prefer type inference where obvious. Do not annotate types the compiler can infer.

### 5.9 Accessibility

- Must pass all AXE checks and follow WCAG AA minimums (focus management, colour contrast, ARIA attributes).

## 6. Strict UI Clone Delivery Protocol (Mandatory)

- **Absolute Screenshot Adherence:** You MUST visually match the original HelloTalk screenshots located in `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/`. Never invent your own UI layouts or use generic web dashboard styles. The clone must be a pixel-perfect, mobile-first design featuring strict dark mode (`#121212` backgrounds), vibrant neon accents, horizontal scrollable pills, and dense flag indicators. Do not consider a UI component "done" if it looks like standard Bootstrap or Tailwind web forms.
- **Responsive Device Support:** We are mobile design first, but the application must fully support tablet and desktop screens. You must provide a unique, rich experience for each device or screen size rather than simply stretching the mobile layout (e.g., utilizing sidebars, multi-pane layouts, or grid adaptations for larger screens).
- **Zero hard-coded strings:** Never write raw hard-coded text inside templates (`*.html`) or component code (`*.ts`). Always pipe UI text through `TranslatePipe` (`| t` / `| t: params`) using keys from `I18nService`.
- **Clone-first scope:** For frontend tasks, ship parity with original HelloTalk behaviour before introducing net-new UI ideas. Improvements are allowed only after parity is reached.
- **Template control flow only:** Never use `*ngIf`, `*ngFor`, `*ngSwitch`, `*ngSwitchCase`, or `*ngSwitchDefault`. Use `@if`, `@for`, and `@switch` exclusively.
- **No `ngClass` or `ngStyle`:** Use native `[class]`, `[class.foo]`, and `[style.prop]` bindings only.
- **Stable tracking:** Every `@for` must track a stable identity key (for example `track item.id`) unless no stable key exists.
- **Design primitives first:** Reuse shared primitives (`app-card`, `app-button-primary`, `app-button-secondary`, `app-input`, `app-textarea`, `app-chip`, `app-pill`, `app-empty-state`) before adding ad hoc utility combinations.
- **Token fidelity:** Prefer values from Tailwind tokens and global app tokens (`surface`, radius, shadow, motion). Do not invent one-off values if an existing token covers the use case.
- **RTL-safe utilities only:** Use logical spacing and borders (`ps`, `pe`, `ms`, `me`, `border-s`, `border-e`) in preference to physical direction utilities.
- **VIP and monetisation copy:** Any price shown in UI must include dual currency format (for example `8 UKP / $10 USD`).
- **Discovery UX parity:** The discovery surface must follow a `Find partners` model, not a `Nearby`-first model. Prioritise partner intent, filter controls, and profile quality signals over distance framing.
- **Filter controls policy:** Do not use free-text input boxes for discovery filters. Use compact controls only (segmented buttons, selects, toggles, chips, and controlled lists). Language filters must be list-driven and searchable via control behaviour.
- **Completion gate for frontend changes:** Before marking frontend work complete, run:
  - `npm run check:control-flow`
  - `npm run build`
  - `npm run test -- --watch=false`
  - `npm run check:rtl-logical`
  - `npm run lint` if the script exists in the project

## 7. Universal Testing Mandate & Test Visiting Protocol (Mandatory)

- **Always Visit Tests:** Whenever you inspect, add, refactor, or debug any code across the workspace (frontend or backend), you must simultaneously open and review the associated test files (`*.spec.ts` / `*.e2e-spec.ts`).
- **Full Primitive Coverage:** Every UI design primitive (`app-card`, `app-button-primary`, `app-button-secondary`, `app-input`, `app-textarea`, `app-chip`, `app-pill`, `app-empty-state`) must be backed by both a standalone component and an exhaustive Vitest unit test suite verifying signal reactivity, host class bindings, accessibility ARIA attributes, and RTL classes.
- **Full API Controller & Service Coverage:** Every NestJS API controller, service, guard, and worker in the `backend/` workspace must have a comprehensive Jest unit test suite (`*.spec.ts`) validating request/response DTO handling, authentication/authorization flows, external service mocks (Supabase, Centrifugo, LiveKit, R2, Redis, NLP.js), and database queries (`pg_trgm`/PostGIS).
- **Continuous Verification:** After modifying any code or test, run the relevant test suite immediately (`npm test` in `backend/` or `npm test -- --watch=false` in `frontend/`) to guarantee zero regressions.

## 8. Known Issues / Audit Findings (Last audited 2026-07-22)

`TODO.md` currently marks every phase as complete, but a full workspace audit found real gaps between what is checked off and what is actually implemented. Treat the items below as the authoritative backlog until they are resolved and this section is updated. Do not re-mark related `TODO.md` items as done without re-verifying against this list.

### 8.1 Critical (fix before any real payments go live)

- **Forged Stripe webhooks accepted:** `POST /monetisation/webhooks/stripe` (`backend/src/monetisation/monetisation.controller.ts` -> `monetisation.service.ts#handleStripeWebhook`) never verifies the Stripe signature (`stripe.webhooks.constructEvent`). The `stripe` package is not even a backend dependency, and `STRIPE_WEBHOOK_SECRET` in `.env.example` is unused dead configuration. Anyone can `curl` a forged `checkout.session.completed` body with an arbitrary `metadata.userId`/`metadata.tier` and grant free VIP to any account. **Fix:** verify the raw request body signature with the Stripe SDK before trusting any event payload.
- **Unauthenticated-of-payment VIP upgrade endpoint:** `POST /monetisation/upgrade` (`monetisation.service.ts#upgradeUser`) sets `is_vip: true` for any logged-in user with no payment/receipt check whatsoever. **Fix:** this endpoint must only be callable internally after a verified payment webhook, never directly by a client.
- **Unlimited free coins exploit:** `POST /economy/purchase-coins` (`backend/src/economy/economy.service.ts#purchaseCoins`) trusts a client-supplied `amount` and credits `coins_balance` directly with no IAP/Stripe receipt verification. Any authenticated user can call this repeatedly to mint infinite coins. **Fix:** derive the coin amount server-side from a verified payment/purchase record, never from client input.
- **Apple/Google App Store webhooks do not exist:** `TODO.md` Phase 7 claims "`MonetisationController` handling Stripe & Apple/Google App Store webhooks" is done. Only a single, unverified, Stripe-shaped webhook exists; there is no App Store Server Notifications or Play Billing webhook handling at all.

### 8.2 High (misleading "done" status, real feature work required)

- **AI/NLP endpoints are hardcoded mocks, not real integrations** (`backend/src/nlp/nlp.service.ts`), despite `SPEC.md`/`TODO.md` claiming Azure AI Translator/DeepL and speech-assessment integrations:
  - `translate()` returns templated strings from a tiny in-memory dictionary; no Azure/DeepL API is ever called.
  - `grammarCheck()` pattern-matches one hardcoded example sentence.
  - `pronunciationScore()` fabricates a score from the word's index, not real audio analysis.
  - These are acceptable as an interim/offline-friendly implementation, but must not be reported as feature-complete until wired to a real provider behind the existing Redis rate limiter.

### 8.3 Medium (fixed during the 2026-07-22 audit; noted for history)

- ~~22 Angular components explicitly set `standalone: true` in the `@Component` decorator~~, violating this project's own Angular v20+ mandate (default is standalone). Removed across all affected files; build/tests/lint re-verified green.
- ~~`audio-sync-reader.component.spec.ts` had 4 ESLint errors (`no-unused-vars`, 3x `no-explicit-any`) and 1 failing Vitest test~~ (a `SpeechSynthesisUtterance` mock used an arrow function, which cannot be invoked with `new`). Fixed; `npm run lint` and `npm run test -- --watch=false` are green in `frontend/`.

### 8.4 Verified healthy

- `npx ng build` (frontend) and `npm run build` (backend) both compile cleanly.
- Backend Jest suite: 283/283 tests passing across 30 suites.
- `node scripts/verify-constitution.mjs` and `check:control-flow` / `check:rtl-logical` / `check:template-bindings` all pass with zero violations.
- Cloudflare R2 presigned uploads (`media.service.ts`), LiveKit room/token management (`audio-rooms.service.ts`), and Centrifugo publish/token minting (`centrifugo.service.ts`) are real SDK integrations, not mocks.

### 8.5 Critical UI Audit Findings (2026-07-23)

- **Failed UI Clone Execution:** Phases 12 and 13 were marked complete, but the current UI (`discovery.component.html`, etc.) completely fails the "pixel-perfect clone" mandate (Rule 6).
- **Gap Summary:** The implementation uses a generic, light-themed web dashboard look (e.g. `bg-slate-50`, native `<select>` dropdowns). The original HelloTalk app (as seen in `/home/elgan/dev/hellotalk/original-hello-talk-screenshots/`) uses a highly stylized, dark-themed mobile design (`#121212` backgrounds, vibrant neon accents). The original app heavily relies on horizontal scrollable filter pills, custom user cards with tight language/fluency indicators (flags), and custom gradient buttons.
- **Fix Required:** Do not consider frontend components "done" if they look like standard Bootstrap/Tailwind web forms. We must implement a strict dark mode, build custom Angular primitives for the scrollable pills and language buttons, and rebuild `discovery` and `chat-list` views to match the screenshots exactly.

## 9. Skills System

Domain-specific, on-demand workflows for recurring engineering tasks on this codebase are documented as Agent Skills under `.agents/skills/<name>/SKILL.md`. Consult (or extend) these before starting related work instead of re-deriving conventions from scratch:

- `nestjs-feature-module` - scaffolding a new backend module (controller/service/DTO/guard/tests).
- `angular-feature-component` - scaffolding a new standalone Angular component following clone-first, i18n, RTL, and primitive-reuse rules.
- `supabase-migration` - writing new SQL migrations with PostGIS/`pg_trgm` conventions.
- `payment-webhook-security` - secure payment/webhook/IAP patterns; created directly in response to the Section 8.1 findings above.
- `realtime-centrifugo-channel` - adding new Centrifugo channels/JSON payload types.
- `livekit-room-flow` - LiveKit room creation, stage management, and token refresh flows.

## 10. Strict Execution & Quality Rules (Added 2026-07-23)

- **Strict Visual Cloning:** You must strictly follow the original screenshots for all UI development. Do not build standard web forms; instead, build custom Angular primitives (e.g., scrollable pills, gradient buttons, flag fluency indicators) to exactly replicate the mobile app experience.
- **No Dead Buttons:** The application must have absolutely zero buttons that do nothing. Every single `<button>`, `<a>`, or clickable element must either have a functional `(click)` handler, a valid `[routerLink]`, or trigger a "Not Implemented" toast notification if the feature is pending.
- **Test Coverage Mandate:** A test must be added for every single feature developed. This includes unit tests for both Angular frontend components/services (`*.spec.ts`) and NestJS backend controllers/services.
- **Fake Data First:** Fake/mock seed data must be added to the backend for every feature as it is developed. The frontend should never render empty states indefinitely during development; it must always populate with realistic placeholder data served from the backend or database seeds to properly validate the UI.
- **NEVER Hardcode Anything:** You must NEVER hardcode data, coin balances, usernames, languages, or UI strings in the frontend or backend services (except inside dedicated mock data generators like `mock-data.ts` or internationalisation dictionaries). Every piece of dynamic state MUST flow from a backend service, state store, or translation pipe. If a database query fails or returns empty, rely ONLY on the centralized `mock-data.ts` for fallback data.
