# Factory dashboard CI efficiency audit

Date: 2026-09-05

## Finding

The repository's canonical CI impact classifier treated `factory-dashboard/**` as an unknown/shared path. A dashboard-only pull request therefore started the full backend/frontend/admin application matrix even though the dashboard is an isolated Factory control-plane service with zero npm dependencies and no product runtime imports.

The auth deployment follow-up used as the audit sample triggered backend/frontend/admin application work despite changing only `factory-dashboard/.env.example`, `factory-dashboard/docker-compose.yml`, and a dashboard test. Those application jobs cannot validate the dashboard behavior. The standalone Clean Project Lint workflow also lacked `factory-dashboard/**` in its proven non-application `paths-ignore` set, so even after classification it would still allocate an impact runner just to decide that application lint is unnecessary.

## Change

`factory-dashboard/**` is now classified as Factory/control-plane scope. The canonical Factory pytest suite executes `node --test` in `factory-dashboard`, so dashboard changes retain direct test coverage inside the required `CI / required` dependency chain.

The standalone Clean Project Lint workflow now ignores dashboard-only pull requests before runner allocation, matching its existing treatment of Factory Python/config/docs. Mixed or unknown diffs still run it because GitHub suppresses a `paths-ignore` workflow only when every changed path is ignored.

The classifier's own change remains deliberately fail-open: this PR itself requires both application and Factory verification, so the optimization cannot validate itself by skipping the application matrix it modifies. This PR also edits Clean Project Lint itself, so that workflow still runs on the exact implementation head.

Mixed dashboard + application diffs still require both canonical CI groups, unknown/shared paths still fail open to application verification, pushes and merge-queue candidates remain full health checks, and the dashboard Node suite is skipped only on local Factory environments where Node is unavailable. GitHub-hosted canonical CI includes Node and therefore executes it.

## Expected efficiency

For a future dashboard-only pull request, canonical CI avoids the 10-entry application matrix (backend lint/build/unit/e2e, frontend static-analysis/build/unit, admin lint/build/unit) and substitutes the dashboard's small zero-dependency Node test suite inside the existing Factory job. Clean Project Lint also avoids its duplicate impact-classifier runner entirely.

This removes up to **11 unnecessary runner allocations per dashboard-only PR** while preserving direct dashboard validation and the required gate. No saving is claimed for mixed, classifier-changing, or Clean Project Lint workflow-changing pull requests.

## Safety

The change does not alter Factory provider routing, allowance admission, prompts, retries, review, verification, current-main gating, or merge behavior. It only removes product checks that cannot observe dashboard behavior and replaces them with the dashboard's own tests in the canonical required path.
