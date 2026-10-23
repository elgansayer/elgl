# Angular frontend bootstrap

Issue #942 tracks the original Angular application bootstrap under `frontend/`.

## Current baseline

The repository contains one Angular application named `frontend` with:

- application source rooted at `frontend/src`;
- browser bootstrap at `src/main.ts`;
- standalone routing in `src/app/app.routes.ts`, registered through `provideRouter(...)` in `src/app/app.config.ts`;
- SCSS as the component schematic style and global style language;
- `src/styles.scss` as the primary global stylesheet;
- the Angular dev-server builder for local development;
- the Angular unit-test builder for component/service tests.

These are the durable outcomes of the original `ng new frontend --style=scss --routing=true --ssr=false` bootstrap request.

## Intentional evolution since bootstrap

The original issue title records `--ssr=false`, but the application has since intentionally adopted Angular server rendering and hydration. `angular.json` now contains `src/main.server.ts`, `server.ts`, `outputMode: server`, and an SSR entry, while `app.config.ts` uses `provideClientHydration()`.

Do not remove the current SSR/hydration setup merely to reproduce the historical generator command. The issue is satisfied by the established Angular project/routing/SCSS baseline; later architecture is allowed to evolve when explicitly adopted by the repository.

## Verification

`frontend/src/app/angular-bootstrap-contract.spec.ts` prevents accidental loss of the bootstrap contract. It checks:

- the `frontend` Angular project remains an application rooted at `src`;
- `src/main.ts` remains the browser entrypoint;
- component schematics and inline styles remain SCSS;
- `src/styles.scss` remains included in the application build;
- the standalone application configuration still registers `app.routes.ts` with Angular Router;
- the browser entrypoint still calls `bootstrapApplication` with `appConfig`.

The normal frontend unit, static-analysis, and production-build CI jobs are authoritative before merge.

## Rollback

This completion change adds only regression coverage and documentation. Reverting the test/documentation commit does not alter application runtime behavior. Any future change to framework, routing, or styling architecture should update this contract deliberately rather than weakening the assertion to hide drift.
