# AGENTS.md (Living Engineering Guidelines)

## 0. Status and Maintenance

This is a living, editable set of loose engineering guidelines, not an immutable constitution - update it like
any other repository document when project needs, tooling, evidence, or explicit user direction changes.

Treat `must`, `never`, `mandatory`, `banned`, `strict`, and `supreme authority` below as strong defaults, not
unconditional prohibitions, unless a rule is mechanically enforced, protects credentials, user data, payments,
repository integrity, or production availability, or is explicitly required by the current task. Current user
direction and evidence-based engineering judgement can justify a scoped departure. Platform and system safety
requirements still take precedence.

Agents may propose and directly update this file as part of normal repository work - no special approval or
separate governance process required. When departing from a guideline, preserve safety, keep the exception
proportionate, and document material trade-offs. The legacy `check:constitution` command name is retained for
compatibility and enforces only the checks that command implements.

## 1. Technology Stack Mandate

Do not substitute these core technologies:

- **Frontend:** Angular (latest stable) with Tailwind CSS.
- **Backend API:** NestJS (TypeScript).
- **Database & Auth:** Supabase (PostgreSQL with PostGIS for spatial queries, `pg_trgm` for search).
- **Real-Time Messaging:** Centrifugo (JWT authentication) + Redis.
- **Real-Time Audio/Video:** LiveKit (WebRTC SFU architecture).
- **Media Hosting:** Cloudflare R2 (S3-compatible, zero egress fees).
- **Language Processing:** NLP.js on the backend for language detection.

## 2. Formatting & Linguistic Rules

- **British English:** use British English spelling for variables, database columns, and UI copy (`colour`, `monetisation`, `tokenise`, `favourite`).
- **Banned Punctuation:** never use an em dash in code, comments, or documentation - use hyphens or colons instead.

## 3. Globalisation, i18n & RTL

Any change touching user-facing text, word tokenisation, or directional CSS: read
`.agents/skills/i18n-translation-workflow/SKILL.md` first. Zero hard-coded UI strings in any language; `TranslatePipe`
(frontend) and `I18nService` (backend/programmatic) carry all user-facing text; `Intl.Segmenter` for tokenisation;
Tailwind logical properties (`ps-4`, `me-2`, `border-s`) for RTL.

## 4. Autonomous Execution Protocol

- **Verification & Test Visiting:** before checking off any task or completing code changes, run `npm run lint` and `npm test` (`npm test -- --watch=false` on frontend) and confirm no TypeScript compiler errors or failing tests. Whenever modifying or adding feature code, visit, review, and update/add the corresponding unit tests (`*.spec.ts`) and E2E tests (`*.e2e-spec.ts`).
- **API First:** Angular never connects to the database directly - every data request routes through the NestJS REST API or Centrifugo WebSockets.
- **A failing build must not reach `main`.** Every PR passes the full verification suite before merge; fix build errors and failing tests within the PR branch itself rather than opening a follow-up "fix" PR.
  - Mechanically enforced: verification workflows run `npm run build && npm test` for backend and frontend. If verification fails, fix the code and re-verify within the same PR. Only green builds merge.
  - Never commit conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`). `fix-rejected-prs.sh` aborts conflicted rebases and leaves them for the Factory.
  - Factory automation and repository workflows never use `gh pr merge --admin`. Autonomous merges use `--squash --delete-branch` and respect every branch rule and required check.
  - The repository-owner user may manually bypass the baseline CI and `factory/independent-review` rulesets, but only through an existing pull request. Broad role/team/app/deploy-key/direct-push/always-mode bypasses stay banned. Manual use must be deliberate and auditable; Factory automation must always require literal success from both statuses and never invoke the owner bypass.
  - Before wiring a component/service to something outside the file being edited (a new npm package, NestJS provider, module import, API endpoint), confirm it actually exists and is registered: is the package in `package.json` and installed? Is the service in its module's `providers`/`imports`? Is the backend route actually mapped (`app.setGlobalPrefix` plus matching frontend `environment.apiUrl`)? Assuming these are wired up because surrounding code implies they should be is exactly how half-finished features have broken this project's build repeatedly.
  - Never introduce a duplicate/orphaned implementation of the same file (a component with both an inline `template:` and an unused sibling `.html`, or two files exporting the same feature under different paths). Search first if a file you're about to create plausibly already exists.
- **Check for existing or overlapping work before starting any task.** Read GitHub issues and skim recent `git log` for the area you're touching. The issue importer's fuzzy-duplicate check only compares task titles, not implementation state - if a task describes something already implemented (even partially, even under a different name), extend or fix that implementation instead of shipping a second, competing one.
- **Always resolve autonomously; never leave work waiting on a human decision.** A quarantined task (repeated identical failure, see `_publish_quarantine`) is a bounded, self-recovering circuit breaker, not an escalation - it never carries a `needs-human` label, and no PR or issue should sit indefinitely for a person to triage. When a task, review, or CI failure presents a choice, take the best-evidenced action yourself (fix it, merge it, close it with a documented reason, or requeue it) instead of pausing for approval. This applies to autonomous agents operating this repository, not to genuine platform-safety or credential boundaries, which still require the repository owner.

## 5. Frontend/Angular Work

`frontend/AGENTS.md` is the supreme authority on Angular coding style and the UI/design-system contract:
zero-tolerance signal/decorator/lifecycle/async pattern bans, Spartan UI mandate, theme parity, responsive
device support, and the frontend completion gate. Read it before touching anything under `frontend/`.

## 6. Universal Testing Mandate & Test Visiting Protocol

- **Always visit tests:** whenever you inspect, add, refactor, or debug code anywhere in the workspace, simultaneously open and review the associated test files (`*.spec.ts` / `*.e2e-spec.ts`).
- **Full primitive coverage:** every approved Relay UI primitive needs a standalone component/directive where applicable and a comprehensive test suite covering its public contract, accessibility semantics, state changes, and RTL behaviour. Don't preserve obsolete primitive names merely to satisfy this rule.
- **Full API controller & service coverage:** every NestJS controller, service, guard, and worker in `backend/` needs a comprehensive Vitest unit suite (`*.spec.ts`) validating request/response DTO handling, authentication/authorization, external service mocks (Supabase, Centrifugo, LiveKit, R2, Redis, NLP.js), and database queries (`pg_trgm`/PostGIS).
- **Continuous verification:** after modifying any code or test, run the relevant suite immediately (`npm test` in `backend/`, `npm test -- --watch=false` in `frontend/`) to confirm zero regressions.

## 7. Skills System

Domain-specific, on-demand workflows for recurring engineering tasks are documented as Agent Skills under
`.agents/skills/<name>/SKILL.md`. Consult (or extend) these before starting related work instead of re-deriving
conventions from scratch:

- `nestjs-feature-module` - scaffolding a new backend module (controller/service/DTO/guard/tests).
- `angular-feature-component` - scaffolding a new standalone Angular component following clone-first, i18n, RTL, and primitive-reuse rules.
- `supabase-migration` - writing new SQL migrations with PostGIS/`pg_trgm` conventions.
- `payment-webhook-security` - secure payment/webhook/IAP patterns.
- `realtime-centrifugo-channel` - adding new Centrifugo channels/JSON payload types.
- `livekit-room-flow` - LiveKit room creation, stage management, and token refresh flows.
- `i18n-translation-workflow` - user-facing text, word tokenisation, RTL layout (frontend and backend).

## 8. Strict Execution & Quality Rules

- **No Dead Buttons:** zero buttons that do nothing anywhere in the application - every clickable element has a functional `(click)` handler, a valid `[routerLink]`, or a "Not Implemented" toast if the feature is pending.
- **Test Coverage Mandate:** a test accompanies every feature - unit tests for both Angular components/services (`*.spec.ts`) and NestJS controllers/services.
- **No Deprecated Packages:** never pick a deprecated npm package; verify dependencies before adding them. Freely pick any actively-maintained tool or package.
- **Fake Data First:** add fake/mock seed data to the backend for every feature as it's developed, so the frontend never renders empty states indefinitely during development - it always populates with realistic placeholder data served from the backend/database seeds. If a database query fails or returns empty, fall back only to the centralised `mock-data.ts`.
- **Never Hardcode Anything:** never hardcode data, coin balances, usernames, languages, or UI strings in frontend or backend services, except inside dedicated mock data generators (`mock-data.ts`) or i18n dictionaries. Every piece of dynamic state flows from a backend service, state store, or translation pipe.
- **Competitive UX Research:** when building features or UX flows, study relevant patterns from leading language-learning, social, communication, conferencing, and collaboration products. Adopt useful ideas only when they fit the Relay design system, accessibility requirements, product goals, and legal/licensing constraints - never copy proprietary assets or duplicate another product's visual identity.

Known issues, audit findings, and completion status live in the GitHub issue backlog, not here -
this file is guidelines, not a changelog.
