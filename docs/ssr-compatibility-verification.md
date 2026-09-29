# SSR compatibility verification

Issue: #5526

This document describes the executable migration gate for the SSR architecture defined in `docs/ssr-compatibility.md`. The gate is intentionally small and dependency-free so it can run before frontend dependencies are installed and can fail quickly when the shared server/browser rendering contract drifts.

## What the gate protects

`npm run check:ssr-compatibility` verifies the repository's current SSR invariants:

- Angular's application builder still emits a server application from `src/main.server.ts` with `outputMode: "server"` and `server.ts` as the SSR entry;
- the shared application still enables client hydration;
- browser-only runtime configuration loading retains an explicit `isPlatformServer(...)` boundary;
- the server configuration still merges the shared `appConfig` and installs `provideServerRendering(withRoutes(serverRoutes))`;
- the server entry still bootstraps the same `AppComponent` with the server config and request `BootstrapContext`;
- server bootstrap/configuration files do not introduce direct browser-global access;
- server rendering remains the default route mode;
- only the reviewed device-heavy routes (`active-call`, `video-call`, `audio-rooms/**`, and `device-transfer`) are client-only;
- `preview/room/:id` and the catch-all route remain explicitly server-rendered;
- representative Discovery, Chat, Vocabulary, and Moderation visual contracts retain light, dark, RTL, and 200% text-scale coverage.

The client-only route allowlist is deliberately explicit. If a new route genuinely requires `RenderMode.Client`, the architecture decision must be reviewed first, the reason documented in `docs/ssr-compatibility.md`, and the verifier allowlist updated in the same change. A small browser-only capability such as clipboard, canvas, storage, notifications, or media playback is not sufficient reason to make an entire route client-only.

## Commands

Run the focused verifier and its self-tests from the repository root:

```sh
node --test scripts/verify-ssr-compatibility.test.mjs
node scripts/verify-ssr-compatibility.mjs
```

Or use the package script:

```sh
npm run check:ssr-compatibility
```

The check is also part of the root `npm run verify` chain and runs in the dedicated **SSR Compatibility Contract** GitHub Actions workflow when SSR-sensitive files change.

## Expected failure modes

The gate exits non-zero and prints only source-contract diagnostics. Typical failures include:

- `build.options.outputMode must remain server` when Angular is accidentally changed to a static/browser-only build;
- `provideClientHydration() is required` when hydration is removed from shared application configuration;
- `raw window access is not allowed` when shared bootstrap code starts reading browser globals directly;
- `new client-only route requires SSR architecture review before allowlisting` when a route is switched to client rendering without an explicit architecture review;
- `the ** fallback must remain RenderMode.Server` when SSR stops being the default;
- `SSR representative must retain dark` (or `light`, `rtl`, `mobile-390-text-200`) when the theme/accessibility regression matrix is weakened.

The verifier never reads environment secrets, browser storage, user data, network responses, or rendered production content. It inspects repository source and configuration only.

## Scope and limitations

This is a migration guard, not a substitute for the Angular production build, component tests, browser E2E tests, accessibility checks, or rendered visual capture. Static verification cannot prove that every lazy route is free from every possible render-time browser API access. Existing build/test and design-governance checks remain authoritative for those layers.

The gate focuses on high-value repository invariants that should never drift silently: the SSR build wiring, hydration, server bootstrap, route-render policy, browser-global boundaries in server-critical files, and representative light/dark/accessibility coverage.

## Rollout and rollback

No runtime, API, schema, routing, persistence, analytics, or visual behavior changes are introduced by this gate. It can be rolled out independently.

If the gate reports a genuine product regression, fix the offending SSR contract rather than bypassing the check. If the architecture intentionally changes, update `docs/ssr-compatibility.md`, the verifier, its tests, and this document together.

Rollback is a normal revert of the verifier, tests, package integration, workflow, and this document. Removing the gate does not require data migration, but it also removes automated protection against SSR architecture drift.
