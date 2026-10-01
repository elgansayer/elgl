# Angular 23 bootstrap readiness

## Scope

The Angular web application no longer relies on the deprecated `APP_INITIALIZER` token or the deprecated Angular animations runtime/provider.

Runtime configuration and deep-link setup now use `provideAppInitializer()`, which executes each initializer inside an Angular injection context. Browser runtime configuration remains bootstrap-blocking; SSR intentionally skips the browser configuration fetch. Deep-link handling remains browser-only, and protocol-handler registration remains best-effort so browser policy rejection cannot prevent application startup.

## Motion policy

The application does not register `provideAnimations()`, `provideAnimationsAsync()`, or `BrowserAnimationsModule`, and it does not require `@angular/animations` as a direct runtime dependency.

Use:

- native CSS transitions/keyframes for ordinary state changes;
- Angular `animate.enter` / `animate.leave` for DOM lifecycle motion;
- the repository `ViewTransitionService` for progressive route/shared-element transitions;
- `prefers-reduced-motion` and the Relay motion contract for accessibility.

Do not reintroduce the legacy Angular animation DSL as a compatibility workaround. If a third-party dependency requires it, treat that as an upgrade blocker and evaluate the dependency first.

## Verification

Focused regression coverage lives in `frontend/src/app/app.config.spec.ts` and verifies:

- browser runtime configuration is awaited before bootstrap completes;
- SSR does not perform the browser configuration fetch;
- configuration rejection remains a real bootstrap failure rather than an apparent success;
- initial deep-link handling remains active;
- missing or rejected protocol-handler registration is non-fatal;
- absence of a browser `defaultView` is safe.

Repository/source searches should remain free of production uses of `APP_INITIALIZER`, `provideAnimations()`, `provideAnimationsAsync()`, `BrowserAnimationsModule`, and `@angular/animations`.

## Rollout

This is a bootstrap-provider migration only. No route, API, hydration, service-worker, translation, or visual-motion semantics are intentionally changed. Deploy through the normal web release path and verify browser startup, SSR rendering, deep links, service-worker registration, dialogs/overlays, reduced-motion behavior, and hydration.

## Rollback

Rollback may restore the previous initializer behavior through `provideAppInitializer()` helpers if a functional regression is found. Do not restore deprecated `APP_INITIALIZER` or the legacy Angular animations provider/runtime; keep Angular 23 compatibility intact while correcting the affected initializer or component.