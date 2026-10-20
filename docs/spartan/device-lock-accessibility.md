# Device lock accessibility completion audit

Issue: #6116 (`Spartan UI 0334`)

Target: `frontend/src/app/components/device-lock`

Status: **complete for the accessibility / RTL / zoom / input-method pass**.

## Result

The device-lock route keeps the existing Spartan native button and Relay semantic surface/text roles while tightening the interaction boundary for assistive technology and high-zoom use.

- The unlock action remains a native `<button hlmBtn size="touch">`; no custom keyboard state machine or click-only element was introduced.
- The existing supporting paragraph is now the stable `device-lock-status` live region. The button references it with `aria-describedby`, so the same relationship is preserved before and after an unlock attempt.
- A failed or unexpectedly rejected unlock shows and politely announces the existing translated `common.error_generic` retry message. No biometric, credential or provider detail is exposed.
- Starting a retry restores the normal translated device-lock message, and unsuccessful attempts leave the native button enabled and focusable.
- Long headings, messages and button labels use wrap-safe layout contracts. The route does not introduce fixed-height or overflow-hidden clipping, so 200%/400% reflow can grow vertically.
- Text remains direction-neutral. `dir="auto"` is used on translated prose, and no physical left/right spacing or positioning utility is introduced.
- The surface adds no component-level animation or transition, so it cannot bypass the repository reduced-motion contract.
- The app shell already owns the `main#main-content` landmark around the router outlet, so this route intentionally does not add a nested `main` landmark.

## Failure and security behaviour

`AppLockService` remains the sole owner of WebAuthn and local lock state. `DeviceLockComponent` receives only the boolean outcome. A `false` result or unexpected rejected promise is reduced to generic retry feedback and never logged or rendered with raw error details.

A successful result preserves the existing exact navigation contract to `/home`. Duplicate attempts remain suppressed by the existing pending guard, and `aria-busy` plus native `disabled` remain active only while the request is pending.

This application lock is still a client-side privacy control, not a replacement for server-side authentication or authorization.

## Regression coverage

`device-lock.component.spec.ts` now locks:

- native Spartan touch-button semantics and descriptive relationship;
- semantic Relay surface/text ownership;
- narrow/high-zoom wrap and overflow contracts;
- duplicate activation and busy-state exposure;
- exact successful `/home` navigation;
- visible + polite failure announcement;
- focus remaining on the retry control after failure;
- fail-safe handling of an unexpected service rejection;
- clearing stale failure feedback when retrying;
- long Arabic/RTL content without physical-direction utilities;
- absence of component-level animation/transition classes.

## Design reconciliation

No token, geometry or mapped preview layout changes are introduced by #6116. The existing device-lock light/mobile and dark/wide Claude Design states from #6115 remain authoritative. The component-system manifest metadata is reconciled for this accessibility-only implementation change so the two-way design drift gate records why the implementation moved without requiring a duplicate visual preview.

## Verification

Recommended focused/full gates:

```bash
cd frontend
npm run test -- --watch=false
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
cd ..
npm run check:design-sync-drift
```

GitHub Actions remains authoritative for the repository-wide frontend, design-system, dependency and E2E contracts.

## Rollout and rollback

No API, schema, route, persistence or credential migration is required. Deploy as a normal frontend release. Mixed versions are safe because the `AppLockService` and route contracts are unchanged.

Rollback is a normal revert of the #6116 commits. Reverting removes the generic live failure feedback and the additional reflow/RTL regression contract but does not modify stored lock configuration or credentials.
