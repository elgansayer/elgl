# Hydration compatibility migration gate

Issue #5528 turns the architecture contract in `docs/hydration-compatibility.md` into a pull-request gate without requiring production credentials or blocking unrelated historical debt.

## What the gate verifies

`node scripts/verify-hydration-compatibility.mjs` verifies the Angular browser/server entrypoints, `outputMode: server`, the shared `provideClientHydration()` provider, merged server configuration, `provideServerRendering()`, and the default `RenderMode.Server` route policy. It also requires the representative Discovery, Chat, Vocabulary, and Moderation visual contracts to retain light, dark, RTL, and 400% reflow states, and requires the existing desktop-English and RTL-Arabic Playwright projects to remain available for browser coverage.

On pull requests the checker compares only added `frontend/src` lines against the base SHA. It rejects high-confidence new hydration hazards: broad `ngSkipHydration`, unreviewed `RenderMode.Client` escape hatches, native DOM tree mutation, direct browser globals in field initialisers, and random/time-derived IDs. Existing repository debt is therefore not converted into unrelated migration failures.

Narrow exceptions must be explicit. Put `hydration-reviewed-skip: <rationale>` in a standalone comment on the immediately preceding line of a reviewed third-party subtree, or `hydration-reviewed-client-render: <rationale>` in a standalone comment on the immediately preceding line of a genuinely browser-only server-route exception. Each marker authorises only that adjacent exception. Bare tokens and same-line markers are rejected, and the marker is not a file-wide bypass: its rationale must be reviewable in the same change.

The dedicated GitHub Actions workflow also runs the visual-contract matrix and a production Angular server build. Repository E2E remains responsible for rendered browser interaction; this gate protects the configuration and source boundaries that make those hydration checks meaningful.

## Verification

Run the dependency-free checks from the repository root:

```bash
node --test scripts/verify-hydration-compatibility.test.mjs
node scripts/verify-hydration-compatibility.mjs
node scripts/verify-visual-contract-matrix.mjs
```

To exercise changed-line comparison locally:

```bash
HYDRATION_BASE_REF=origin/main node scripts/verify-hydration-compatibility.mjs
```

Then verify the production server bundle:

```bash
cd frontend
npm ci
npm run build
```

Expected failures are actionable, for example:

```text
Hydration compatibility contract failed:
- provideClientHydration() is missing from shared application providers
- frontend/src/app/app.routes.server.ts: new RenderMode.Client route requires a hydration-reviewed-client-render marker
- frontend/src/app/pages/example/example.component.html: new ngSkipHydration requires a hydration-reviewed-skip exception marker
```

## Accessibility and theme coverage

Hydration must preserve semantics rather than create separate theme or RTL trees. The gate therefore locks the existing representative matrix states for light theme, dark theme, RTL direction, and 400% text/reflow. Keyboard and translated RTL browser behaviour continue to run through the repository Playwright projects and canonical CI.

## Rollout and rollback

This is verification-only. It changes no route, API, schema, persistence, theme token, visual composition, analytics, or runtime hydration behaviour. No Claude Design preview update is required because the visual contract is unchanged. Roll back by reverting the gate files; do not disable Angular hydration to work around a failing check.
