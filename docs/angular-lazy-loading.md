# Angular standalone lazy loading

Issue #1817 asked for Angular lazy loading of non-critical feature modules. The application now uses standalone Angular components rather than feature `NgModule` classes, so the production equivalent is route-level dynamic component loading with `loadComponent` and, where a route collection genuinely needs its own boundary, `loadChildren`.

## Current contract

`frontend/src/app/app.routes.ts` and the route collections under `frontend/src/app/routes/` must not attach routed components through the eager `component` property. Product surfaces such as Community, Vocabulary, Discovery, Moments, Events, Settings and Chat are loaded through dynamic import callbacks.

This keeps routed component code out of the initial application bundle until navigation needs it while preserving the existing URL structure, redirects, guards and route titles. Shared shell code, services required during application bootstrap and redirect-only routes are not forced into artificial feature-module wrappers.

## Why standalone routing

The frontend engineering standard prohibits `NgModule`. Reintroducing feature modules only to satisfy older lazy-loading terminology would add a second architecture without improving code splitting. Standalone `loadComponent` is the canonical Angular boundary for routed screens in this repository.

## Verification

The regression suite at `frontend/src/app/app.routes.lazy-loading.spec.ts` verifies that:

- no routed component is attached eagerly through `Route.component`;
- representative non-critical product routes retain dynamic component or child-route loaders;
- redirect-only routes do not accidentally acquire component loaders.

Run the normal frontend verification from `frontend/`:

```bash
npm run test -- --watch=false
npm run check:control-flow
npm run check:rtl-logical
npm run lint
npm run build
```

The repository CI remains authoritative for clean dependency installation and production compilation.

## Rollout and rollback

This change adds a regression contract and documentation only. It does not alter routes, API contracts, persisted state or deployment configuration. Rollback is a normal code revert. If a future route genuinely needs eager bootstrap ownership, document the performance reason and update the contract deliberately rather than bypassing the test.
