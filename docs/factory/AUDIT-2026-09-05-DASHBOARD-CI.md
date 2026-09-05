# Factory dashboard CI efficiency audit

Date: 2026-09-05

## Finding

The repository's canonical CI impact classifier treated `factory-dashboard/**` as an unknown/shared path. A dashboard-only pull request therefore started the full backend/frontend/admin application matrix even though the dashboard is an isolated Factory control-plane service with zero npm dependencies and no product runtime imports.

The auth deployment follow-up used as the audit sample triggered backend/frontend/admin application work despite changing only `factory-dashboard/.env.example`, `factory-dashboard/docker-compose.yml`, and a dashboard test. Those application jobs cannot validate the dashboard behavior. The same missing classification also caused standalone application lint, core product E2E discovery/flow, root core-Compose, dependency-review, and production mock-boundary workflows to allocate runners for dashboard-only changes.

## Change

`factory-dashboard/**` is now classified as Factory/control-plane scope. The canonical Factory pytest suite executes `node --test` in `factory-dashboard`, so dashboard changes retain direct test coverage inside the required `CI / required` dependency chain.

Standalone product workflows now treat dashboard-only pull requests like the existing Factory Python/config/docs scope:

- Clean Project Lint skips before runner allocation.
- E2E Core Product Flows skips before runner allocation.
- E2E Runner Context skips before runner allocation.
- Core Compose Contract skips before runner allocation because it verifies the root product compose contract, not the separate dashboard compose stack.
- Dependency Review skips dashboard source/tests/README/example-env changes, while `factory-dashboard/package.json`, Dockerfile, Compose, GitHub Actions, and other dependency/infrastructure inputs remain covered.
- Mock Backend Production Boundary skips non-artifact dashboard changes, while its ordered path rules deliberately re-include dashboard Dockerfile/Compose and other recognized production-artifact markers.

The classifier's own change remains deliberately fail-open: this PR itself requires both application and Factory verification, so the optimization cannot validate itself by skipping the application matrix it modifies. The affected workflow files are also changed in this PR, so their exact implementations still execute during validation.

Mixed dashboard + application diffs still require both canonical CI groups and product workflows, unknown/shared paths still fail open to application verification, pushes and merge-queue candidates remain full health checks, and the dashboard Node suite is skipped only on local Factory environments where Node is unavailable. GitHub-hosted canonical CI includes Node and therefore executes it.

## Expected efficiency

For a future dashboard source/test/docs-only pull request, the current baseline can allocate:

- 10 application-matrix runners in canonical CI;
- 4 Clean Project Lint runners (impact, lint contract, backend lint, frontend lint);
- 2 E2E Core Product Flows runners (impact + contract);
- 2 E2E Runner Context runners (impact + Playwright discovery);
- 2 Core Compose Contract runners (impact + contract);
- 1 Dependency Review runner;
- 1 Mock Backend Production Boundary runner.

The new policy removes up to **22 unnecessary runner allocations per dashboard source/test/docs-only PR** and substitutes the dashboard's small zero-dependency Node suite inside the existing Factory job. Package/dependency or Docker/Compose/production-artifact changes intentionally retain the relevant dependency/boundary checks, so their saving is smaller.

## Safety

The change does not alter Factory provider routing, allowance admission, prompts, retries, review, verification, current-main gating, or merge behavior. It removes product checks that cannot observe dashboard behavior and replaces them with the dashboard's own tests in the canonical required path. Workflow self-changes, mixed changes, package/dependency changes, production-artifact changes, and unknown paths continue to fail open.
