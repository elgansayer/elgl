# AGENTS.md (Living Engineering Guidelines)

## 0. Status and maintenance

This file is a living, editable set of loose engineering guidelines. It is not an immutable constitution and
may be updated like any other repository document when project needs, tooling, evidence, or explicit user
direction changes.

Treat words such as `must`, `never`, `mandatory`, `banned`, `strict`, and `supreme authority` below as strong
defaults rather than unconditional prohibitions, unless a rule is mechanically enforced, protects credentials,
user data, payments, repository integrity, or production availability, or is explicitly required by the current
task. Current user direction and evidence-based engineering judgement may justify a scoped departure. Platform
and system safety requirements still take precedence.

Agents may propose and directly update this file as part of normal repository work. No special approval or
separate governance process is required. When departing from a guideline, preserve safety, keep the exception
proportionate, and document material trade-offs. The legacy `check:constitution` command name is retained for
compatibility and enforces only the checks implemented by that command.

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

## 3. Globalisation & RTL Layout Rules

- **Universal Tokenisation:** You must use the native JavaScript `Intl.Segmenter` API (which achieved baseline browser support in 2024) to parse all text into clickable word tokens. Never use regex or space-splitting.
- **RTL CSS:** You must strictly use Tailwind logical properties (e.g., `ps-4`, `me-2`, `border-s`) instead of physical directions (`pl-4`, `mr-2`, `border-l`). This ensures the Angular interface natively mirrors for Arabic, Hebrew, and Persian.
- **Zero Hard-Coded Strings & Universal Translation System:** The application must support ANY language with 0 hard-coded UI strings. Never hard-code user-facing text inside Angular templates (`*.html`) or TypeScript (`*.ts`). All text in component templates MUST use `TranslatePipe` (`{{ 'key' | t }}` or `{{ 'key' | t: { param: value } }}`) imported from `src/app/services/translate.pipe.ts`. All programmatic text inside code MUST use `I18nService.translate('key', params)` injected from `src/app/services/i18n.service.ts`. The `I18nService` manages reactive locale state, document directionality (`dir="rtl"`/`dir="ltr"`), and fallback lookups with dynamic backend translation (`/nlp/translate-ui`).

## 4. Autonomous Execution Protocol

- **Verification & Test Visiting:** Before checking off any task in `TODO.md` or completing any code changes, you must run `npm run lint` and `npm test` (`npm test -- --watch=false` on frontend) and verify no TypeScript compiler errors or failing tests exist. Whenever modifying or adding feature code, you must ALWAYS visit, review, and update/add corresponding unit tests (`*.spec.ts`) and E2E tests (`*.e2e-spec.ts`).
- **API First:** Angular must never connect to the database directly. Every data request must route through the NestJS REST API or Centrifugo WebSockets.
- **A failing build MUST NOT reach `main`.** Every PR must pass the full verification suite before merge. The Factory must fix build errors and failing tests within the PR branch itself before merging. Do not create follow-up "fix" PRs for failures that should have been caught before merge.
  - This is enforced mechanically: All verification workflows run `npm run build && npm test` for both backend and frontend. If verification fails, the AI must fix the code and re-verify within the same PR. Only green builds may be merged.
  - Conflict markers (<<<<<<<, =======, >>>>>>>) are NEVER committed. The `fix-rejected-prs.sh` script aborts conflicted rebases and leaves them for the Factory to handle.
  - Factory automation and repository workflows must never use `gh pr merge --admin`. Autonomous merges use `--squash --delete-branch` and respect every branch rule and required check.
  - The exact repository-owner user may manually bypass the baseline CI and dedicated `factory/independent-review` rulesets, but only through an existing pull request. Broad role, team, app, deploy-key, direct-push, and always-mode bypasses remain banned. Manual use must be deliberate and auditable. Factory automation must still require literal success from both statuses and must never invoke the owner bypass.
  - Before wiring a component/service to something outside the file you're editing (a new NPM package, a new NestJS provider, a new module import, an API endpoint), confirm it actually exists and is registered: is the package in `package.json` _and_ installed? Is the service in its module's `providers`/`imports`? Is the backend route actually mapped (check for `app.setGlobalPrefix` and matching frontend `environment.apiUrl`)? Assuming these are wired up because the surrounding code implies they should be is exactly how half-finished features have broken the build repeatedly in this project's history.
  - Never introduce a duplicate/orphaned implementation of the same file (e.g. a component with both an inline `template:` and an unused sibling `.html` file, or two files exporting the same feature under different paths). If you are about to create a file that plausibly already exists (a shared UI shell, a service, a DTO), search for it first.
- **Before starting any task, check for existing or overlapping work.** Read GitHub issues and skim recent `git log` for the area you're about to touch. The GitHub issue importer runs a fuzzy-duplicate check so near-duplicate task titles like "Add a moment system" and "Build the moments feature" should not both reach the queue -- but that check only looks at task _titles_, not implementation state. If a task describes something that's already implemented (even partially, even under a different name), don't re-implement it from scratch: extend or fix the existing implementation instead of shipping a second, competing one.

## 5. Angular Modern Patterns (Mandatory - Zero Tolerance for Legacy)

This section is the **supreme authority** on Angular coding style. Every rule below is a hard ban with zero exceptions. Violations will cause CI/build failure.

### 5.1 Decorator Bans (NEVER use these)

- **NEVER `@Input()`** -- use the `input.required<T>()` or `input<T>(default)` signal function.
- **NEVER `@Output()`** -- use the `output<T>()` signal function.
- **NEVER `@ViewChild()` / `@ViewChildren()`** -- use `viewChild()` / `viewChildren()` signal queries.
- **NEVER `@ContentChild()` / `@ContentChildren()`** -- use `contentChild()` / `contentChildren()` signal queries.
- **NEVER `@HostBinding()` / `@HostListener()`** -- use the `host: { ... }` property in `@Component()` / `@Directive()`.
- **NEVER `@NgModule` or `@Module`** -- all Angular components must ALWAYS be standalone (default in Angular v20+). Never ever use `@Module({` or `@NgModule({` in the frontend codebase.

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

## 6. UI Evolution & Design System Protocol

- **Single visual authority:** `DESIGN.md`, `docs/spartan-relay-architecture.md`, and the scoped `frontend/AGENTS.md` define the frontend visual and component contract. Relay semantic tokens own colour, surface, typography, spacing, radius, elevation, density, and motion roles. Spartan Brain owns reusable accessible interaction behaviour. Owned Spartan Helm code under `frontend/src/app/components/ui/` adapts that behaviour for the application. Feature code composes Relay/Helm primitives and must not create a competing visual system.
- **Theme parity:** Light and dark themes are both first-class. Never impose a global `#121212`, neon, or dark-only mandate. Product character must be expressed through Relay semantic roles and approved variants that remain valid across themes, forced colours, reduced motion, and per-user primary accents.
- **Spartan first for interactive mechanics:** Do not hand-roll focus traps, roving tabindex, combobox/listbox/menu keyboard state, dialog Escape/backdrop behaviour, or other interaction state machines when an approved Spartan primitive exists. Prefer existing Helm components and Relay wrappers before adding new abstractions.
- **Claude Design two-way workflow:** For material UI work follow `docs/claude-design-two-way-sync.md`. Claude Design is the editable design-intent/review workspace, while runtime Angular code, Relay tokens, Spartan interaction contracts, and automated tests remain authoritative for shipped software. Design-first and code-first changes must reconcile rather than silently overwrite either side.
- **Responsive Device Support:** We are mobile design first, but the application must fully support tablet and desktop screens. Provide deliberate responsive compositions rather than simply stretching mobile layout, using sidebars, multi-pane layouts, or grid adaptations where they improve the experience.
- **Zero hard-coded strings:** Never write raw hard-coded text inside templates (`*.html`) or component code (`*.ts`). Always pipe UI text through `TranslatePipe` (`| t` / `| t: params`) using keys from `I18nService`.
- **Feature-first scope:** Deliver high-quality user experiences for parity features and net-new ideas while remaining inside the Relay + Spartan contract.
- **Template control flow only:** Never use `*ngIf`, `*ngFor`, `*ngSwitch`, `*ngSwitchCase`, or `*ngSwitchDefault`. Use `@if`, `@for`, and `@switch` exclusively.
- **No `ngClass` or `ngStyle`:** Use native `[class]`, `[class.foo]`, and `[style.prop]` bindings only.
- **Stable tracking:** Every `@for` must track a stable identity key (for example `track item.id`) unless no stable key exists.
- **Relay primitives first:** Reuse the current approved Relay primitives and Spartan Helm adapters before adding ad hoc utility combinations or a new primitive. When an existing primitive lacks a required capability, extend its documented API or add a justified semantic variant rather than creating a parallel component family.
- **Token fidelity:** Use Relay semantic tokens for product styling. Do not invent one-off colours, surfaces, radii, shadows, or motion values when a semantic role already exists.
- **RTL-safe utilities only:** Use logical spacing and borders (`ps`, `pe`, `ms`, `me`, `border-s`, `border-e`) in preference to physical direction utilities.
- **VIP and monetisation copy:** Ensure any price shown in UI is formatted properly.
- **Discovery UX parity:** The discovery surface must follow a `Find partners` model, not a `Nearby`-first model. Prioritise partner intent, filter controls, and profile quality signals over distance framing.
- **Filter controls policy:** Do not use free-text input boxes for discovery filters. Use compact controls only (segmented buttons, selects, toggles, chips, and controlled lists). Language filters must be list-driven and searchable via control behaviour.
- **Completion gate for frontend changes:** Before marking frontend work complete, run:
  - `npm run check:control-flow`
  - `npm run build`
  - `npm run test -- --watch=false`
  - `npm run check:rtl-logical`
  - `npm run lint` if the script exists in the project
  - the root `npm run check:design-sync` when a mapped visual contract changes

## 7. Universal Testing Mandate & Test Visiting Protocol (Mandatory)

- **Always Visit Tests:** Whenever you inspect, add, refactor, or debug any code across the workspace (frontend or backend), you must simultaneously open and review the associated test files (`*.spec.ts` / `*.e2e-spec.ts`).
- **Full Primitive Coverage:** Every approved Relay UI primitive must be backed by a standalone component or directive where applicable and a comprehensive test suite covering its public contract, accessibility semantics, state changes, and RTL behaviour. Do not preserve obsolete primitive names merely to satisfy this rule.
- **Full API Controller & Service Coverage:** Every NestJS API controller, service, guard, and worker in the `backend/` workspace must have a comprehensive Vitest unit test suite (`*.spec.ts`) validating request/response DTO handling, authentication/authorization flows, external service mocks (Supabase, Centrifugo, LiveKit, R2, Redis, NLP.js), and database queries (`pg_trgm`/PostGIS).
- **Continuous Verification:** After modifying any code or test, run the relevant test suite immediately (`npm test` in `backend/` or `npm test -- --watch=false` in `frontend/`) to guarantee zero regressions.

## 8. Known Issues / Audit Findings (Last audited 2026-08-16)

`TODO.md` currently marks every phase as complete, but the following items are the authoritative backlog.

### 8.1 Critical (resolved as of 2026-07-29)

- ~~**Forged Stripe webhooks accepted:** `monetisation.service.ts#handleStripeWebhook` now uses `stripe.webhooks.constructEvent()` with verified signature.~~ **FIXED.**
- ~~**Unauthenticated VIP upgrade endpoint:** The `POST /monetisation/upgrade` endpoint has been removed. `updateVipStatus()` is now `private`, only callable via `updateVipStatusFromWebhook()` from verified webhook handlers.~~ **FIXED.**
- ~~**Unlimited free coins exploit:** `purchaseCoins()` now verifies receipts via Apple/Google/Stripe APIs, derives coin amount server-side from `COIN_PACKAGES`, and checks for duplicate transaction IDs.~~ **FIXED.**
- ~~**Apple/Google App Store webhooks:** Both `POST /monetisation/webhooks/apple` (AppleNotificationService) and `POST /monetisation/webhooks/google` (GooglePlayNotificationService) exist with JWS/PubSub verification.~~ **FIXED.**

### 8.2 High (resolved as of 2026-07-29)

- ~~**AI/NLP endpoints were hardcoded mocks:** `translate()` now calls DeepL API (`api-free.deepl.com/v2/translate`), `grammarCheck()` calls Azure Translator API, `pronunciationScore()` calls Azure Speech Services. All are real integrations with Redis rate limiting and Langfuse tracing.~~ **FIXED.**

### 8.3 Frontend Type Safety (in progress)

- **73 `as` type assertions exist in production code** (currently `warn` in ESLint). Must be migrated to proper type narrowing, type guards, or Zod validation before upgrading to `error`.
- **ESLint `no-console: error`** (allowing only `warn` and `error`) -- all `console.log` instances cleaned.
- **ESLint `@typescript-eslint/no-explicit-any: error`** -- `any` type is banned project-wide.

### 8.4 Verified healthy

- `npx ng build` (frontend) and `npm run build` (backend) both compile cleanly.
- Frontend Vitest suite: 212 test files, 1828 tests passing.
- Backend Vitest suite: 2754/2754 tests passing across 208 suites.
- `node scripts/verify-constitution.mjs` and `check:control-flow` / `check:rtl-logical` / `check:template-bindings` all pass with zero violations.
- Cloudflare R2, LiveKit, Centrifugo, Stripe, DeepL, Azure -- all real SDK/API integrations.

### 8.5 Critical UI Audit Findings (pending)

- **Spartan migration incomplete:** Spartan Brain/Helm is installed and the Relay ownership architecture is established, but the numbered migration backlog remains active across shared primitives and feature surfaces. Do not equate package installation with full integration.
- **Design-system drift risk:** Shared overlays/dialogs, direct Brain imports from feature code, generated Helm drift, and remaining hand-built interaction behaviour must converge on the Relay + Spartan ownership model.
- **Claude Design reconciliation:** `docs/claude-design-two-way-sync.md` defines the required two-way workflow. Stable mapping coverage and changed-files-aware drift detection are still being expanded.
- **Legacy screenshot references:** `original-hello-talk-screenshots/` may inform product behaviour and useful interaction ideas, but it does not override Relay semantic tokens, first-class light/dark themes, accessibility, Spartan ownership, or the current design system.
- **`.env.example`** missing most required configuration variables (see `backend/src/config/validation.schema.ts` for full list).

## 9. Skills System

Domain-specific, on-demand workflows for recurring engineering tasks on this codebase are documented as Agent Skills under `.agents/skills/<name>/SKILL.md`. Consult (or extend) these before starting related work instead of re-deriving conventions from scratch:

- `nestjs-feature-module` - scaffolding a new backend module (controller/service/DTO/guard/tests).
- `angular-feature-component` - scaffolding a new standalone Angular component following clone-first, i18n, RTL, and primitive-reuse rules.
- `supabase-migration` - writing new SQL migrations with PostGIS/`pg_trgm` conventions.
- `payment-webhook-security` - secure payment/webhook/IAP patterns; created directly in response to the Section 8.1 findings above.
- `realtime-centrifugo-channel` - adding new Centrifugo channels/JSON payload types.
- `livekit-room-flow` - LiveKit room creation, stage management, and token refresh flows.

## 10. Strict Execution & Quality Rules (Added 2026-07-23)

- **Design Language Consistency:** All UI development must follow the Relay + Spartan architecture defined by `DESIGN.md` and `docs/spartan-relay-architecture.md`. Preserve the product's distinctive language-learning identity through semantic tokens and documented variants, not through parallel custom primitive families or a mandatory dark/neon aesthetic.
- **No Dead Buttons:** The application must have absolutely zero buttons that do nothing. Every single `<button>`, `<a>`, or clickable element must either have a functional `(click)` handler, a valid `[routerLink]`, or trigger a "Not Implemented" toast notification if the feature is pending.
- **Test Coverage Mandate:** A test must be added for every single feature developed. This includes unit tests for both Angular frontend components/services (`*.spec.ts`) and NestJS backend controllers/services.
- **No Deprecated Packages:** You must never pick npm packages that are deprecated, but still feel free to pick any tools or packages widely in use. Always verify dependencies before adding them.
- **Fake Data First:** Fake/mock seed data must be added to the backend for every feature as it is developed. The frontend should never render empty states indefinitely during development; it must always populate with realistic placeholder data served from the backend or database seeds to properly validate the UI.
- **NEVER Hardcode Anything:** You must NEVER hardcode data, coin balances, usernames, languages, or UI strings in the frontend or backend services (except inside dedicated mock data generators like `mock-data.ts` or internationalisation dictionaries). Every piece of dynamic state MUST flow from a backend service, state store, or translation pipe. If a database query fails or returns empty, rely ONLY on the centralized `mock-data.ts` for fallback data.
- **Competitive UX Research:** When building features or designing UX flows, study relevant patterns from leading language-learning, social, communication, conferencing, and collaboration products. Adopt useful interaction ideas only when they fit the Relay design system, accessibility requirements, product goals, and legal/licensing constraints. Do not copy proprietary assets or blindly duplicate another product's visual identity.
