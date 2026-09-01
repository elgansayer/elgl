# Direct dependency disposition register

**Repository:** `elgansayer/elgl`  
**Audit date:** 2026-08-19  
**Programme tracker:** #7463  
**Package governance issue:** #7478  
**Workspace migration:** #7452  

## Purpose

This register assigns an explicit disposition to every direct dependency declared by every package manifest inspected in the repository.

The register answers:

- What capability does the dependency own?
- Where is it used?
- Is it runtime, development, test, build or tool-only?
- Should it be kept, consolidated, moved, replaced, trialled or removed?
- Which issue owns the safe migration?
- What evidence is required before deletion?
- Which packages must move together during upgrades?

This is a decision register, not an automatic deletion list. Static-import absence is not enough to remove a package that may be used through Angular builders, Nest CLI, npm scripts, dynamic imports, generated code, Docker, GitHub Actions or optional provider paths.

## Disposition vocabulary

| Status | Meaning |
|---|---|
| **KEEP** | Package is appropriate and currently owns a required capability. |
| **KEEP / ALIGN** | Keep, but align versions and update as a coherent lane. |
| **CONSOLIDATE** | Keep the capability while reducing duplicate wrappers or emitters. |
| **MOVE** | Keep, but move to the correct workspace or dependency section. |
| **REPLACE** | Existing package or use should be replaced through an owning migration. |
| **REMOVE CANDIDATE** | Evidence strongly suggests removal, but build/runtime proof is still required. |
| **INVESTIGATE** | Current evidence is insufficient for a safe final decision. |
| **TRIAL CANDIDATE** | Proposed addition, not yet approved for permanent production use. |

## Manifest inventory

The audit inspected:

```text
/package.json
/frontend/package.json
/backend/package.json
/admin-portal/package.json
/e2e/package.json
/tests/load/package.json
/.agents/skills/caveman-learn/package.json
/.agents/skills/caveman-explore/package.json
/automation/pyproject.toml
/automation/uv.lock
```

The two Caveman skill packages currently declare no external dependencies. They remain separate skill/test packages and must not be pulled into the product runtime workspace accidentally.

## Cross-repository decisions

### One npm workspace

#7452 should establish one root npm workspace and one supported install flow for web, backend, admin, E2E, load tests and approved shared packages. Physical source moves are optional.

Do not delete child lockfiles until Docker, CI, deploy and local install paths demonstrably consume the root lockfile correctly.

### Version lanes

These families should update coherently:

| Lane | Packages |
|---|---|
| Angular runtime | `@angular/common`, `compiler`, `core`, `forms`, `platform-browser`, `platform-server`, `router`, `service-worker`, `ssr`, `cdk` |
| Angular build | `@angular/build`, `cli`, `compiler-cli`, `angular-eslint` |
| Spartan | `@spartan-ng/brain`, `@spartan-ng/cli` |
| TypeScript/lint | `typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `angular-eslint`, Prettier integrations |
| Testing | Vitest, jsdom, coverage, Supertest, Cypress, Playwright |
| Supabase | `@supabase/supabase-js`, CLI and generated database types |
| Nest | Nest core/plugins, CLI, schematics and testing |
| AWS/R2 | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |
| Logging/telemetry | Pino family, `prom-client`, `hot-shots`, future OpenTelemetry packages |
| Firebase | browser Firebase decision and server `firebase-admin` provider |
| Factory Python | `openhands-sdk`, `openhands-tools`, `pydantic`, `httpx`, `filelock` and locked development tools |

Intentional version divergence needs an owner, reason and compatibility test.

## Root workspace manifest

### Runtime dependencies

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@ngx-translate/core` | `^15.0.0` | No root application runtime; older than frontend v18 | **MOVE / REMOVE CANDIDATE** | #7452. Keep translation only in consuming Angular workspace/shared config. Prove no root script imports it. |
| `@ngx-translate/http-loader` | `^8.0.0` | No root application runtime; older than frontend v18 | **MOVE / REMOVE CANDIDATE** | #7452. Remove root duplicate after one workspace install and build prove it is unused. |
| `xss` | `^1.0.15` | No verified root runtime owner; overlaps DOMPurify/content policy | **REMOVE CANDIDATE** | #7476 and #7478. Search dynamic/scripts, then remove if no approved sink depends on it. |

### Development dependencies

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@eslint/js` | `^10.0.1` | Shared ESLint flat-config base | **KEEP / ALIGN** | #7452. Centralize shared lint configuration and align backend's older declared range. |
| `artillery` | `^2.0.34` | Duplicates load-test workspace dependency | **MOVE / REMOVE ROOT DUPLICATE** | #7452 and #5365. Load workspace should own the CLI unless a root target consumes the workspace binary explicitly. |
| `husky` | `^9.1.7` | Git hook installation | **KEEP** | Root tooling owner. Hooks must remain fast, reproducible and non-authoritative compared with CI. |
| `lint-staged` | `^15.2.10` | Changed-file formatting | **KEEP / ALIGN** | Root tooling owner. Verify Node 22 and Prettier lane. Do not let mutation-only hooks replace CI checks. |
| `prettier` | `^3.3.3` | Root formatting | **KEEP / ALIGN** | #7452. Align the root, frontend and backend Prettier versions and one configuration. |

## Frontend manifest

### Angular runtime

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@angular/animations` | `22.1.2` | Deprecated Angular animation runtime | **REPLACE / REMOVE** | #7457 and #7469. Migrate to native CSS and `animate.enter`/`animate.leave`, then remove. |
| `@angular/cdk` | `^22.1.2` | Overlay, accessibility and primitive support used by Angular/Spartan patterns | **KEEP / ALIGN** | UI platform. Keep in Angular lane and avoid direct feature reimplementation. |
| `@angular/common` | `^22.1.2` | Core Angular directives, HTTP and platform services | **KEEP / ALIGN** | Angular lane. Align exact compatible versions. |
| `@angular/compiler` | `^22.1.2` | Angular runtime/JIT metadata where required | **KEEP / ALIGN** | Angular lane. Confirm production bundling remains AOT. |
| `@angular/core` | `^22.1.1` | Application framework | **KEEP / ALIGN** | Angular lane. Align with 22.1.2 family unless compatibility requires another patch. |
| `@angular/forms` | `^22.1.2` | Forms | **KEEP / ALIGN** | Angular lane. Prefer typed/reactive forms and shared field primitives. |
| `@angular/platform-browser` | `^22.1.2` | Browser bootstrap/rendering | **KEEP / ALIGN** | Angular lane. |
| `@angular/platform-server` | `^22.1.2` | SSR | **KEEP / ALIGN** | Angular lane. Keep browser-only packages isolated from SSR. |
| `@angular/router` | `^22.1.2` | Routing | **KEEP / ALIGN** | Angular lane. Coordinates resources, lazy loading and view-transition adapter. |
| `@angular/service-worker` | `^22.1.2` | PWA/service worker | **KEEP / ALIGN** | #7475. Use Angular `SwPush` for browser Web Push and avoid competing workers. |
| `@angular/ssr` | `^22.1.4` | Angular SSR server/build integration | **KEEP / ALIGN** | Angular lane. Verify compatibility with Express and browser-only adapters. |

### UI, icons, styling and animation

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@ng-icons/core` | `>=32.0.0 <34.0.0` | Angular icon registry/runtime | **KEEP / ALIGN** | UI platform. Keep bounded with matching Lucide package. |
| `@ng-icons/lucide` | `>=32.0.0 <34.0.0` | Lucide icon set | **KEEP / ALIGN** | UI platform. Use semantic labels and avoid emoji as UI icons. |
| `@spartan-ng/brain` | `^1.3.1` | Accessible primitive behaviour | **KEEP / ALIGN** | #7453. Keep aligned with Spartan CLI and owned Helm source. |
| `class-variance-authority` | `^0.7.0` | Variant composition for owned components | **KEEP** | Shared UI. Retain while public component APIs use it consistently. |
| `clsx` | `^2.1.1` | Conditional class composition | **KEEP / CONSOLIDATE** | Shared UI. Use through common class utility where possible. |
| `tailwind-merge` | `^3.5.0` | Tailwind class conflict resolution | **KEEP** | Shared UI. Pair with CVA/clsx utility rather than feature copies. |
| `lottie-web` | `^5.13.0` | Direct authored-animation player used by owned wrapper | **KEEP / CONSOLIDATE** | #7469. One lazy adapter, allowlisted assets, teardown, budgets and static fallback. |
| `ngx-lottie` | `^22.0.0` | No verified indexed source consumer; duplicates direct Lottie integration | **REMOVE CANDIDATE** | #7469 and #7478. Remove after production build, config and dynamic-import proof. |
| `ngx-joyride` | `^2.5.0` | Product tours in several feature services | **REPLACE / REMOVE** | #7470. Migrate to one typed tour platform and renderer decision. |
| `ngx-skeleton-loader` | `^13.0.0` | Narrow profile skeleton use | **REPLACE / REMOVE** | #7479. Replace with shared Relay/Spartan loading primitives. |
| `tw-animate-css` | `^1.4.0` | Tailwind animation utilities used by UI primitives | **KEEP / REVIEW** | #7457/#7469. Retain only for approved tokenized native CSS motion; inventory actual classes. |

### Internationalisation

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@ngx-translate/core` | `^18.0.0` | Runtime translation | **KEEP / ALIGN** | I18n platform. Shared workspace config, translation-safe component APIs and tests. |
| `@ngx-translate/http-loader` | `^18.0.0` | Loads JSON translation resources | **KEEP / ALIGN** | I18n platform. Remove older root duplicate. |

### Data, realtime, media and product integrations

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@supabase/supabase-js` | `^2.112.3` | Auth, database, storage and realtime client boundary | **KEEP / ALIGN** | #7446/#7449. Type with generated `Database`; keep one auth/data authority. |
| `centrifuge` | `^5.7.1` | Realtime messaging/presence client | **KEEP** | Realtime platform. Do not replace with custom WebSockets. |
| `livekit-client` | `^2.21.0` | Calls, rooms, tracks and screen share | **KEEP / CONSOLIDATE** | #7466. One Angular media-session adapter above it. |
| `chart.js` | `^4.4.1` | Chart rendering | **KEEP** | Analytics UI. Add shared accessible wrapper/table equivalent where repeated. |
| `ng2-charts` | `^5.0.4` | Angular Chart.js integration | **KEEP / ALIGN** | Analytics UI. Ensure Chart.js peer compatibility. |
| `ngx-image-cropper` | `^9.1.6` | Interactive image crop preview | **KEEP** | #7468. Keep client editing; server Sharp remains authoritative. |
| `firebase` | `^12.17.1` | Browser Firebase SDK, while messaging services are stubs | **REPLACE / REMOVE CANDIDATE** | #7475. Implement Angular `SwPush`; remove browser Firebase if no other real feature remains. |
| `dompurify` | `^3.4.13` | Frontend text/HTML sanitisation wrapper | **CONSOLIDATE / INVESTIGATE** | #7476. Keep only approved rich-HTML boundary; remove redundant plain-text mutation. |
| `express` | `^5.2.1` | Angular SSR runtime/server adapter | **KEEP / VERIFY PLACEMENT** | SSR owner. Confirm runtime import in generated/custom server entry and production image. |
| `rxjs` | `~7.8.0` | Angular streams/realtime/cancellation | **KEEP / ALIGN** | #7456. Keep for streaming; do not force every state into resources/store. |
| `tslib` | `^2.3.0` | TypeScript runtime helpers | **KEEP / ALIGN** | TypeScript lane. |

### Frontend build and development dependencies

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@angular/build` | `^22.1.4` | Angular application/unit-test builder | **KEEP / ALIGN** | Angular build lane. |
| `@angular/cli` | `^22.1.3` | Angular CLI | **KEEP / ALIGN** | Angular build lane. |
| `@angular/compiler-cli` | `^22.1.2` | Angular AOT compiler | **KEEP / ALIGN** | Angular build lane. |
| `@eslint/js` | `^10.0.1` | ESLint base rules | **KEEP / ALIGN** | #7452. Shared lint config. |
| `@spartan-ng/cli` | `^1.3.1` | Helm generation/info/healthcheck | **KEEP / ALIGN** | #7453. Lockstep with Brain where supported. |
| `@tailwindcss/postcss` | `^4.3.3` | Tailwind PostCSS integration | **KEEP / ALIGN** | Tailwind lane. |
| `@types/dom-mediacapture-record` | `^1.0.22` | Media capture TypeScript declarations | **KEEP / INVESTIGATE** | #7467. Retain only if TypeScript DOM lib lacks required declarations after recorder consolidation. |
| `@types/express` | `^5.0.6` | SSR Express types | **KEEP / ALIGN** | SSR development only. |
| `@types/node` | `^26.2.0` | Node/SSR/build types | **KEEP / ALIGN** | #7452. Ensure Angular target compatibility and avoid global browser type pollution. |
| `angular-eslint` | `^22.1.0` | Angular template/TypeScript linting | **KEEP / ALIGN** | Angular build lane. |
| `autoprefixer` | `^10.5.4` | CSS compatibility processing | **KEEP / VERIFY** | Tailwind/PostCSS owner. Remove only if current Tailwind/build pipeline proves redundant. |
| `cypress` | `^15.20.1` | Frontend E2E and visual capture | **KEEP PENDING COVERAGE DECISION** | #5365/#7454. Retain until Cypress/Playwright/Storybook coverage map removes proven duplication. |
| `eslint` | `^10.8.1` | Linter | **KEEP / ALIGN** | Shared lint lane. |
| `eslint-formatter-compact` | `^9.0.1` | Compact lint output | **INVESTIGATE / REMOVE CANDIDATE** | #7478. Verify scripts/CI; remove if no command references it. |
| `fake-indexeddb` | `^6.2.5` | Browser storage unit-test implementation | **KEEP** | #7450. Continue for Dexie/raw IndexedDB migration tests. |
| `jsdom` | `^28.1.0` | Unit-test DOM | **KEEP / ALIGN** | Testing lane. Do not ship in browser bundle. |
| `listr2` | `10.2.1` | No verified frontend runtime purpose; likely script/CLI helper | **INVESTIGATE** | #7478. Trace import/script usage and remove or move to tools workspace. |
| `postcss` | `^8.5.26` | CSS processing | **KEEP / ALIGN** | Tailwind lane. |
| `prettier` | `^3.8.1` | Frontend formatting | **KEEP / ALIGN** | #7452. One repository version/config. |
| `start-server-and-test` | `^3.0.12` | Starts dev server for Cypress/visual tests | **KEEP PENDING E2E CONSOLIDATION** | #5365/#7454. Remove if Playwright/Storybook replaces all consumers. |
| `tailwindcss` | `^4.3.3` | Utility CSS/design token implementation | **KEEP / ALIGN** | #7453. Shared web/admin setup. |
| `typescript` | `~6.0.3` | Frontend compiler | **KEEP / ALIGN** | #7452. Angular-supported lane. |
| `typescript-eslint` | `^8.67.0` | Type-aware lint tooling | **KEEP / ALIGN** | Shared lint lane. |
| `vitest` | `^4.0.8` | Unit tests | **KEEP / ALIGN** | Testing lane. Storybook browser integration coordinates with #7454. |

## Backend manifest

### Storage, database, queues and infrastructure

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@aws-sdk/client-s3` | `^3.1111.0` | R2 S3-compatible storage client | **KEEP / ALIGN** | #7468. One storage adapter; direct intents and worker derivatives. |
| `@aws-sdk/s3-request-presigner` | `^3.1111.0` | Signed R2/S3 operations | **KEEP / ALIGN** | #7468. Narrow purpose/key/expiry signing only. |
| `@supabase/supabase-js` | `^2.112.3` | Primary auth/database/Redis service boundary | **KEEP / ALIGN** | #7446/#7449. Generated types and one schema authority. |
| `ioredis` | `^5.11.1` | Redis client | **KEEP** | #7448. Reuse for BullMQ/cache/rate limits with controlled connection ownership. |
| `typeorm` | `^1.1.0` | Secondary migration/entity path | **REPLACE / REMOVE CANDIDATE** | #7449. Remove only after migration mapping and runtime import proof. |
| `uuid` | `^14.0.1` | UUID generation/parsing | **INVESTIGATE / KEEP IF API NEEDED** | #7478. Prefer native `crypto.randomUUID` for simple generation; retain if package-specific versions/parsing remain used. |

### Nest runtime

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@nestjs/common` | `^11.2.1` | Nest framework | **KEEP / ALIGN** | Nest lane. |
| `@nestjs/config` | `^4.0.4` | Typed/environment configuration integration | **KEEP** | Configuration owner. Continue validated startup config. |
| `@nestjs/core` | `^11.2.1` | Nest framework runtime | **KEEP / ALIGN** | Nest lane. |
| `@nestjs/event-emitter` | `^3.1.0` | In-process domain events | **KEEP / NARROW** | #7448. Retain only where loss is explicitly acceptable; durable side effects move to jobs. |
| `@nestjs/platform-express` | `^11.2.1` | HTTP adapter/Multer integration | **KEEP / ALIGN** | Nest lane. Reassess only with measured adapter need. |
| `@nestjs/schedule` | `^6.1.3` | Cron/scheduled tasks | **KEEP DURING MIGRATION / NARROW** | #7448/#7477. Durable schedules move to BullMQ; retain duplicate-safe process-local tasks only. |
| `@nestjs/swagger` | `^11.4.6` | OpenAPI generation | **KEEP** | #7447. Deterministic contract generation and linting. |
| `@nestjs/throttler` | `^6.5.0` | API rate limiting | **KEEP** | Security platform. Add distributed storage where multi-replica policy requires it. |
| `@nestjs/axios` | `^4.0.1` | Nest Axios integration | **INVESTIGATE / CONSOLIDATE** | #7478/#7461. Native fetch is already widely used; keep only for actual HttpService consumers. |
| `axios` | `^1.19.0` | HTTP client underlying direct or Nest Axios use | **INVESTIGATE / CONSOLIDATE** | Same owner. Select explicit fetch/Axios boundaries and remove duplicate client if unused. |
| `rxjs` | `^7.8.1` | Nest/HTTP/event streams | **KEEP / ALIGN** | Nest lane. |
| `reflect-metadata` | `^0.2.2` | Decorator metadata required by Nest | **KEEP** | Nest runtime. |

### Validation, security and authentication

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `class-transformer` | `^0.5.1` | DTO transformation | **KEEP** | Nest DTO boundary. Avoid treating transformation as validation. |
| `class-validator` | `^0.15.1` | DTO validation | **KEEP** | Nest DTO boundary. Generated OpenAPI metadata must remain accurate. |
| `joi` | `^18.2.3` | Environment/config validation | **KEEP** | Configuration owner. Avoid a second config-schema framework without need. |
| `helmet` | `^8.3.0` | HTTP security headers | **KEEP** | #7476. Configure CSP/Trusted Types deliberately. |
| `jsonwebtoken` | `^9.0.3` | JWT handling where verified low-level operations are needed | **KEEP / NARROW** | Auth owner. Prefer verified Supabase/JWKS paths, never decode-only authorization. |
| `jwks-rsa` | `3.2.0` | JWKS key retrieval/cache | **KEEP** | Auth owner. Bound cache/timeout/failure and rotate safely. |
| `speakeasy` | `^2.0.0` | Custom TOTP | **REPLACE / REMOVE** | #7446. Supabase MFA/AAL owns factors. |
| `qrcode` | `^1.5.4` | QR generation for custom TOTP | **REMOVE CANDIDATE AFTER MFA** | #7446. Retain only if another approved product QR feature exists. |
| `dompurify` | `^3.4.13` | Server HTML sanitisation | **KEEP / CONSOLIDATE** | #7476. One explicit rich-HTML boundary and versioned allowlist. |
| `jsdom` | `26.1.0` | Server DOM implementation for DOMPurify | **KEEP ONLY IF SERVER RICH HTML REMAINS** | #7476. Align/current security lane; never use as generic production browser emulation. |
| `xss` | `^1.0.15` | Overlaps content sanitisation, no clear authoritative owner | **REMOVE CANDIDATE** | #7476/#7478. Remove after source/dynamic evidence and sink tests. |
| `ip-address` | `^10.5.0` | IP parsing for link-preview/network safety | **KEEP** | SSRF/link-preview security. Validate IPv4/IPv6/private/special ranges. |
| `is-ip` | `^5.0.1` | IP detection | **KEEP / CONSOLIDATE** | Same owner. Remove only if `ip-address` fully replaces the proven call sites. |

### Realtime, media, notifications and providers

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `livekit-server-sdk` | `^2.17.0` | Room/token/server media operations | **KEEP** | #7466. Backend grants and media policy remain authoritative. |
| `sharp` | `^0.35.3` | Image decode/transform/derivatives | **KEEP** | #7468. Move heavy processing to bounded durable workers. |
| `firebase-admin` | `^14.2.0` | FCM/server Firebase operations | **KEEP / ISOLATE** | #7475. Centralized provider/worker initialization and current target API. |
| `nodemailer` | `^9.0.5` | Email delivery | **KEEP / PROVIDER-ADAPTER** | Notifications/email owner. Durable jobs, templates and provider fault semantics. |
| `stripe` | `^14.25.0` | Payments/subscriptions/webhooks | **KEEP / UPGRADE LANE** | Payments owner. Version is notably behind current SDK family; upgrade through webhook/API compatibility tests. |
| `node-nlp` | `^5.0.0-alpha.5` | Language detection through `Language.guess`; large alpha dependency tree | **BENCHMARK / REMOVE CANDIDATE** | #7474. Compare explicit metadata, provider detection, tinyld and franc-min. |
| `xlsx` | SheetJS CDN tarball `0.20.3` | Override pulled by NLP dependency and potential spreadsheet handling | **REMOVE CANDIDATE / PROVENANCE REVIEW** | #7474/#7478. Remove with node-nlp if no direct feature remains; otherwise isolate and govern tarball provenance. |
| `cheerio` | `^1.0.0` | Server HTML parsing for link previews | **KEEP / HARDEN** | Link-preview owner. Continue SSRF, size, redirect and content limits. |

### Logging and metrics

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `nestjs-pino` | `^4.6.1` | Nest structured logging integration | **KEEP / ALIGN** | #7455. Add trace/span correlation. |
| `pino` | `^10.3.1` | Structured logger | **KEEP / ALIGN** | Logging lane. |
| `pino-http` | `^11.0.0` | HTTP logging | **KEEP / CONSOLIDATE** | Logging lane. Ensure Nest integration does not duplicate request logs. |
| `prom-client` | `^15.1.3` | Prometheus-compatible metrics | **KEEP DURING OTel MIGRATION** | #7455. Remove duplicate emitters only after dashboards/alerts parity. |
| `hot-shots` | `^17.1.0` | StatsD metrics | **CONSOLIDATE / REMOVE LATER** | #7455. Map metrics to OTel/Prometheus and remove only after parity. |

### Backend development and test dependencies

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@eslint/eslintrc` | `^3.2.0` | Legacy ESLint config compatibility | **INVESTIGATE / REMOVE WHEN FLAT CONFIG COMPLETE** | #7452/#7478. |
| `@eslint/js` | `^9.18.0` | ESLint rules, behind root/frontend v10 | **KEEP / ALIGN** | Shared lint lane. |
| `@nestjs/cli` | `^11.0.0` | Nest build/dev CLI | **KEEP / ALIGN** | Nest build lane. |
| `@nestjs/schematics` | `^11.0.0` | Nest generators | **KEEP / ALIGN** | Nest build lane; dev only. |
| `@nestjs/testing` | `^11.2.1` | Nest tests | **KEEP / ALIGN** | Nest lane. |
| `@swc/core` | `^1.16.0` | Fast TypeScript compilation | **KEEP / ALIGN** | Build/test lane. Verify platform-native packages in lock/images. |
| `@types/express` | `^5.0.0` | Express types | **KEEP / ALIGN** | Dev only. |
| `@types/jsdom` | `^28.0.3` | jsdom types incorrectly in runtime dependencies | **MOVE TO DEV / ALIGN** | #7476/#7478. Match actual jsdom major or avoid cross-major type mismatch. |
| `@types/jsonwebtoken` | `^9.0.10` | JWT types | **KEEP** | Dev only. |
| `@types/multer` | `^2.2.0` | Upload types | **KEEP DURING UPLOAD MIGRATION** | #7468. Reassess after direct-to-R2 removes most API-buffered uploads. |
| `@types/node` | `^26.2.0` | Node types | **KEEP / ALIGN** | Shared TypeScript lane. |
| `@types/nodemailer` | `^8.0.1` | Email types | **KEEP / ALIGN WITH RUNTIME** | Dev only; verify compatibility with nodemailer v9. |
| `@types/qrcode` | `^1.5.6` | QR types | **REMOVE WITH QRCODE IF UNUSED** | #7446. |
| `@types/speakeasy` | `^2.0.10` | Speakeasy types | **REMOVE WITH SPEAKEASY** | #7446. |
| `@types/supertest` | `^7.0.0` | API test types | **KEEP / ALIGN** | Testing lane. |
| `@vitest/coverage-v8` | `^4.1.10` | Coverage | **KEEP / ALIGN** | #5365. Align with Vitest version. |
| `eslint` | `^10.8.1` | Linter | **KEEP / ALIGN** | Shared lint lane. |
| `eslint-config-prettier` | `^10.0.1` | Turns off conflicting formatting rules | **KEEP / ALIGN** | Shared lint/format lane. |
| `eslint-plugin-prettier` | `^5.5.6` | Runs Prettier as ESLint rule | **INVESTIGATE / SIMPLIFY** | #7452/#7478. Consider separate Prettier check to reduce lint coupling/noise. |
| `globals` | `^17.11.0` | ESLint environment globals | **KEEP / ALIGN** | Shared lint lane. |
| `ngrok` | `^5.0.0-beta.2` | Local tunnel script | **INVESTIGATE / MOVE OR REMOVE** | #7478. Keep only in explicit local-tools workspace if webhook development requires it. |
| `prettier` | `^3.4.2` | Backend formatting | **KEEP / ALIGN** | One root version/config. |
| `source-map-support` | `^0.5.21` | Runtime stack source maps, declared dev-only | **INVESTIGATE PLACEMENT** | Verify production bootstrap/import and Node native source-map setting. Move runtime or remove accordingly. |
| `supertest` | `^7.0.0` | HTTP integration tests | **KEEP / ALIGN** | Testing lane. |
| `ts-loader` | `^9.5.2` | TypeScript/Webpack loader | **INVESTIGATE / REMOVE CANDIDATE** | Verify Nest builder after SWC/unplugin setup. Do not retain redundant compiler path. |
| `ts-node` | `^10.9.2` | Seed/verify TypeScript scripts | **KEEP DURING TOOL MIGRATION** | #7452/#7449. Replace with built scripts or `tsx` only through a deliberate decision. |
| `tsconfig-paths` | `^4.2.0` | Runtime path aliases for ts-node scripts | **KEEP WITH TS-NODE** | Reassess together. |
| `typescript` | `^5.7.3` | Backend compiler, behind frontend v6 | **KEEP / ALIGN WHEN NEST SUPPORTS** | #7452. Compatibility lane and staged upgrade. |
| `typescript-eslint` | `^8.67.0` | TypeScript ESLint | **KEEP / ALIGN** | Shared lint lane. |
| `unplugin-swc` | `^1.5.11` | Vitest/build SWC integration | **KEEP / VERIFY** | Build/test lane. Remove if configuration no longer imports it. |
| `vitest` | `^4.1.10` | Unit/E2E tests | **KEEP / ALIGN** | Testing lane. |

## Admin portal manifest

### Runtime dependencies

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@angular/common` | `^22.1.1` | Angular runtime | **KEEP / ALIGN** | #7452/#7453. Align with web Angular lane. |
| `@angular/compiler` | `^22.1.1` | Angular compiler runtime metadata | **KEEP / ALIGN** | Angular lane. |
| `@angular/core` | `^22.1.1` | Angular framework | **KEEP / ALIGN** | Angular lane. |
| `@angular/forms` | `^22.1.1` | Admin forms | **KEEP / ALIGN** | Typed forms and shared field primitives. |
| `@angular/platform-browser` | `^22.1.1` | Browser rendering | **KEEP / ALIGN** | Angular lane. |
| `@angular/router` | `^22.1.1` | Admin routing | **KEEP / ALIGN** | Angular lane. |
| `@supabase/supabase-js` | `^2.112.3` | Admin authentication/session | **KEEP / ALIGN** | #7446/#7447. Strong assurance and generated API client. |
| `rxjs` | `~7.8.0` | Streams | **KEEP / ALIGN** | Angular lane. |
| `tslib` | `^2.3.0` | TypeScript helpers | **KEEP / ALIGN** | TypeScript lane. |

### Development dependencies

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@angular/build` | `^22.1.3` | Builder/tests | **KEEP / ALIGN** | Angular build lane. |
| `@angular/cli` | `^22.1.3` | Angular CLI | **KEEP / ALIGN** | Angular build lane. |
| `@angular/compiler-cli` | `^22.1.1` | AOT compiler | **KEEP / ALIGN** | Angular build lane. |
| `@eslint/js` | `^10.0.1` | ESLint base | **KEEP / ALIGN** | Shared lint config. |
| `angular-eslint` | `^22.1.0` | Angular lint | **KEEP / ALIGN** | Angular build lane. |
| `eslint` | `^10.8.0` | Linter | **KEEP / ALIGN** | Shared lint lane. |
| `jsdom` | `^30.0.1` | Unit-test DOM, ahead of frontend/backend | **KEEP / ALIGN CAREFULLY** | Testing lane. Align only when Angular/Vitest compatibility is proven. |
| `typescript` | `~6.0.3` | Compiler | **KEEP / ALIGN** | Angular lane. |
| `typescript-eslint` | `^8.67.0` | TypeScript lint | **KEEP / ALIGN** | Shared lint lane. |
| `vitest` | `^4.0.8` | Unit tests | **KEEP / ALIGN** | Testing lane. |

### Missing shared dependencies

The admin portal currently does not directly declare Spartan/Tailwind/shared API-client packages because #7453/#7452 have not yet established the shared workspace boundary. Add them through shared libraries, not by independently reproducing the frontend manifest.

## Playwright E2E manifest

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `@playwright/test` | `^1.50.1` | Cross-browser E2E, RTL and visual flows | **KEEP / UPGRADE LANE** | #5365/#7454. Current package is old relative to 2026; upgrade through browser/version and snapshot compatibility tests. |
| `@types/node` | `^24.0.0` | Test configuration types | **KEEP / ALIGN** | #7452. Align supported Node type lane or document why E2E differs. |
| `typescript` | `^5.7.3` | E2E compiler | **KEEP / ALIGN** | #7452. Align after Playwright/config compatibility. |

Cypress and Playwright both remain until #5365 maps journey/visual/component coverage and removes only proven overlap.

## Load-test manifest

| Package | Version | Current role | Disposition | Owner / action |
|---|---:|---|---|---|
| `artillery` | `^2.0.34` | API and product load scenarios | **KEEP IN LOAD WORKSPACE** | #5365/#7452. Remove root duplicate, pin/lock this workspace and keep production credentials/data out of scripts. |

The load suite includes scenarios named for discovery map and other features. A scenario name is not proof that the user-facing capability is implemented. #7472 owns the map product decision.

## Agent skill manifests

### `@caveman/skill-caveman-learn`

No external dependencies. **KEEP AS ISOLATED SKILL PACKAGE.**

- Node built-in test runner only.
- Do not include in product production images.
- Keep consent and token-safety semantics independent from application dependencies.
- If npm workspaces include the package for testing, tag it as `type:tool`/`scope:agents` and forbid imports from product apps.

### `@caveman/skill-caveman-explore`

No external dependencies. **KEEP AS ISOLATED SKILL PACKAGE.**

- Node built-in test runner only.
- Do not include in product production images.
- Preserve read-only/citation-only behaviour.
- Same workspace boundary rules as other agent tools.

## OpenHands Factory Python project

### Build system

| Package | Version | Role | Disposition | Owner / action |
|---|---:|---|---|---|
| `hatchling` | `1.27.0` | Python build backend | **KEEP PINNED** | Factory Python lane. Update with wheel/build reproducibility tests. |

### Runtime dependencies

| Package | Version | Role | Disposition | Owner / action |
|---|---:|---|---|---|
| `filelock` | `3.20.1` | Cross-process file/state/worktree locking | **KEEP PINNED** | Factory safety. Do not replace with process-local mutexes. |
| `httpx` | `0.28.1` | Async/sync HTTP for GitHub/OpenHands/provider boundaries | **KEEP PINNED** | Factory networking. Bound timeout, redaction and retry semantics. |
| `openhands-sdk` | `1.41.0` | OpenHands provider/SDK integration | **KEEP PINNED** | Existing OpenHands fallback/provider boundary. |
| `openhands-tools` | `1.41.0` | OpenHands tools integration | **KEEP PINNED / LOCKSTEP** | Keep aligned with SDK. |
| `pydantic` | `2.12.5` | Typed configuration/state/result validation | **KEEP PINNED** | Factory typed models and backward-compatible state loading. |

### Development dependencies

| Package | Version | Role | Disposition | Owner / action |
|---|---:|---|---|---|
| `mypy` | `1.17.1` | Strict type checking | **KEEP PINNED** | Factory CI. |
| `pytest` | `9.1.1` | Tests | **KEEP PINNED** | Factory CI. |
| `pytest-cov` | `6.2.1` | Coverage | **KEEP PINNED** | Factory CI. Align with pytest compatibility. |
| `ruff` | `0.12.8` | Lint/format/static checks | **KEEP PINNED** | Factory CI. |

### Factory architecture decision

The Factory already contains provider-neutral adapters and routing for Claude, Codex, Google, OpenCode and OpenHands. Preserve it.

Do not:

- put provider CLI credentials in Python/npm lockfiles or builds;
- replace the scheduler/worktree/review/verification authority with one vendor CLI;
- make standard CI consume subscription quotas;
- remove OpenHands SDK merely because subscription CLIs are preferred for some phases.

Provider host executables and authenticated sessions are deployment prerequisites, not Python package dependencies. Credential directories remain minimal, provider-specific and outside repositories.

## Proposed package candidates not yet approved

These packages may be added only through their owning trial/implementation issue.

| Candidate | Intended capability | Status | Owning issue | Exit requirement |
|---|---|---|---|---|
| `perfect-freehand` | Freehand stroke geometry | **ADOPT CANDIDATE** | #7465 | Vector fidelity, pressure, performance and deterministic tests. |
| tldraw packages | Full collaborative whiteboard | **TRIAL CANDIDATE** | #7465 | Product requirement, Angular boundary, self-hosted sync, accessibility and one winner. |
| Excalidraw packages | Full collaborative whiteboard | **TRIAL CANDIDATE** | #7465 | Same scenario; remove when rejected. |
| Yjs | Narrow CRDT collaboration | **CONDITIONAL TRIAL** | #7465 | Only if collaboration need remains narrow and no whiteboard platform owns it. |
| `wavesurfer.js` | Waveform/seek/regions | **TRIAL CANDIDATE** | #7467 | Low-end performance, accessible semantic player and server peaks. |
| Uppy Core / AWS S3 | Direct/resumable R2 upload | **TRIAL CANDIDATE** | #7468 | R2 multipart, Angular/SSR isolation, accessibility and lazy bundle. |
| Rive web runtime | Interactive animation state machines | **TRIAL CANDIDATE** | #7469 | State-driven product value, performance, accessibility and static fallback. |
| dotLottie player | Compressed Lottie packaging | **TRIAL CANDIDATE** | #7469 | Measured advantage over the retained direct Lottie adapter. |
| Driver.js | Product-tour renderer | **TRIAL CANDIDATE** | #7470 | Angular lifecycle, CSP, focus, screen reader, zoom and missing targets. |
| `emoji-picker-element` | Maintained Unicode picker/data | **TRIAL CANDIDATE** | #7471 | Locale, accessibility, lazy bundle and low-end performance. |
| MapLibre GL JS | Optional discovery map | **PRODUCT-GATED TRIAL** | #7472 | Privacy/safety approval and full semantic list parity. |
| `diff` / jsdiff | Multilingual correction diff | **ADOPT CANDIDATE** | #7473 | Golden corpus and exact reconstruction invariants. |
| `tinyld` | Language detection | **BENCHMARK** | #7474 | Accuracy/calibration/coverage/dependency comparison. |
| `franc-min` | Language detection | **BENCHMARK** | #7474 | Same corpus; one selected strategy. |
| `web-push` | Server Web Push protocol | **ADOPT CANDIDATE** | #7475 | Current security/maintenance and provider fault tests. |
| Temporal polyfill | Explicit time-domain implementation | **TRIAL / SELECT ONE** | #7477 | Native parity, browser/Node support, bundle/runtime and removal path. |
| Knip | Unused dependency/file/export analysis | **ADOPT AFTER WORKSPACES** | #7478 | Correct entries/plugins and classified baseline. |
| Cockatiel | Backend resilience policies | **ADOPT CANDIDATE** | #7461 | Typed transient predicates, mutation idempotency and telemetry. |
| BullMQ / Nest BullMQ | Durable jobs | **ADOPT CANDIDATE** | #7448 | Redis integration, idempotency, worker operations and #3503 DLQ. |
| OpenTelemetry JS | Server/worker telemetry | **ADOPT CANDIDATE** | #7455 | Redaction/cardinality/export failure safety and dashboard parity. |
| Dexie | Browser offline database/outbox | **ADOPT CANDIDATE** | #7450 | Migration, partitioning, cross-tab lease, quota and privacy tests. |
| `ts-fsrs` | SRS scheduler | **ADOPT CANDIDATE** | #7451 | Shadow rollout, immutable logs and workload/retention evidence. |
| NgRx SignalStore | Feature state | **ADOPT CANDIDATE** | #7456 | Reference domains, bundle/runtime measurement and no global-store misuse. |
| Storybook Angular Vite | Component catalogue/browser tests | **PREVIEW TRIAL** | #7454 | Stable production/CI build or explicit rejection/removal. |

## Initial removal queue

Removal order follows feature safety, not package-name convenience.

| Package | Remove only after |
|---|---|
| `@angular/animations` | #7457 native motion and overlay/focus tests pass. |
| `speakeasy`, `qrcode`, their types | #7446 Supabase MFA migration/recovery window completes. |
| `typeorm` | #7449 proves one Supabase migration authority and no runtime dependency. |
| `ngx-lottie` | #7469 verifies direct Lottie adapter and no dynamic/config consumer. |
| `ngx-joyride` | #7470 migrates every tour and completion key. |
| `ngx-skeleton-loader` | #7479 migrates its consumers. |
| browser `firebase` | #7475 implements PWA Web Push and proves no other browser Firebase feature. |
| `node-nlp`, `xlsx` | #7474 detector benchmark and runtime inventory reject them. |
| `xss` | #7476 proves no approved content sink requires it. |
| root ngx-translate duplicates | #7452 workspace install/build proves ownership in frontend/shared package. |
| root `artillery` | load workspace target is callable from root/Nx without duplicate declaration. |
| `ngrok` | supported webhook/local tunnel workflow has another explicit tool path or is retired. |
| `eslint-formatter-compact`, `listr2`, `ts-loader` | script/config/dynamic search and relevant build/test proof show no consumer. |
| `hot-shots` | #7455 dashboards/alerts reach OTel/Prometheus parity. |

## Evidence required for a package removal PR

A removal PR must include:

1. Manifest and lockfile change.
2. `npm explain` or equivalent dependency-tree evidence before removal.
3. Source, config, npm script, CI, Docker and dynamic-import search.
4. The specific capability replacement or reason the feature is dead.
5. Production build and relevant runtime smoke.
6. Unit/integration/browser tests for the affected path.
7. Bundle/container/SBOM delta where meaningful.
8. Migration/rollback for persisted data or public imports.
9. Documentation update and issue link.
10. No broad Knip/ESLint ignore added to hide the result.

## CI rollout

### Phase 1: informational

- npm workspace/manifest inventory artifact;
- Knip report with classified baseline;
- package provenance report;
- version-lane drift report;
- production-image dependency/SBOM report.

### Phase 2: new regressions

Fail on:

- unlisted dependencies and unresolved imports;
- new direct dependency with no adoption metadata/owner;
- new URL/Git/tarball dependency without provenance approval;
- lockfile or generated-client/type drift;
- runtime import of a dev-only package;
- product import from agent/tool-only packages.

### Phase 3: stable unused checks

After entry/plugin configuration is trustworthy, fail on new unused direct dependencies in changed workspaces. Keep a small reviewed ignore file with reason, owner and expiry.

### Phase 4: scheduled full-tree governance

- unused dependency/file/export report;
- vulnerability/licence/provenance/SBOM checks;
- bundle and production-container dependency growth;
- version-lane drift;
- review of expired trials/ignores and obsolete packages.

## Completion criteria

The package programme is complete when:

1. every direct dependency has an owner and disposition;
2. every manifest is part of a reproducible install/test/build path;
3. npm workspaces and entry points make automated analysis trustworthy;
4. high-confidence duplicate/unused packages are removed through safe feature migrations;
5. runtime, dev, worker and tool dependencies are placed correctly;
6. non-registry/native/tool dependencies have provenance, integrity, licence and update policy;
7. version lanes are aligned or intentionally documented;
8. standard CI needs no live provider subscriptions or production credentials;
9. production images exclude test/design/agent tooling;
10. trials end in adopt, reject/remove or defer without a retained production dependency;
11. the OpenHands Factory remains provider-neutral, subscription-first where configured, and authoritative for scheduling, worktrees, review and verification;
12. this register is regenerated or reviewed after each architecture audit and major workspace/package migration.
