# Factory efficiency audit - 2026-08-31

## Scope

This audit re-read the current Factory implementation and its surrounding control plane rather than carrying forward assumptions from earlier audits. The review covered provider routing and health, conservative allowance admission, prompt budgets, durable retries, GitHub discovery, pull-request review/merge ownership, Factory verification, production instance configuration, and the standalone GitHub Actions workflows that are repeatedly triggered by Factory changes.

The current production Factory already has strong model-side controls: one new issue per hour, six real provider starts per hour globally, four starts per task per interval, two concurrent agent processes, one concurrent independent review, at most two provider candidates per logical route, no immediate same-provider retry while conservative mode is active, first-failure provider circuit breaking, shared provider health/capacity across repository instances, bounded task/evidence prompts, mechanical CI repair before AI repair, lower reasoning/model tiers for bounded repair/review phases, and OpenHands PAYG disabled in production. Those controls remain unchanged.

## Current backlog and discovery pressure

At audit time GitHub reported 3,801 open issues and 182 open pull requests. The production daemon refresh cadence remains five minutes. `GitHubClient.collect_open_issues()` and `collect_open_pull_requests()` each request the complete open set, so the theoretical upper-bound record processing at an unchanged backlog is:

- 288 discovery refreshes per day;
- 1,094,688 issue records per day;
- 52,416 pull-request records per day;
- 1,147,104 combined records per day.

The earlier recommendation to separate slow issue discovery from faster active-PR/check reconciliation is still valid. I did not force that architectural change into this PR because current `FactoryPipeline.refresh()` treats one complete issue+PR snapshot as the authoritative retirement boundary. A safe split needs source-scoped retirement tests so an issue-only or PR-only refresh can never mark the other source's durable jobs complete. The current five-minute cadence is therefore preserved until that lifecycle boundary is explicit.

## Finding 1: Clean Project Lint allocates a duplicate classifier runner

`Clean project lint` runs an `impact` job on every pull request, checks out full history, then invokes the same fail-open `scripts/classify-ci-impact.sh` logic already used by canonical CI. On a Factory-only PR the classifier says application lint is unnecessary, but GitHub has already allocated the Ubuntu runner and performed the checkout.

The repository's active `main` ruleset requires only `CI / required`; Clean Project Lint is not a required status. Canonical CI therefore remains the authoritative impact classifier and merge gate.

### Change

The pull-request trigger now has a conservative `paths-ignore` set matching paths that the canonical classifier already proves cannot affect the backend/frontend application lint lane: Factory Python, Factory/systemd configuration, docs, Dependabot configuration, and the small set of Factory-only workflows already recognised by the classifier.

GitHub `paths-ignore` only suppresses a run when every changed path is ignored. Mixed or unknown diffs therefore still run. Changes to `ci.yml`, `clean-project-lint.yml`, or the classifier script itself are deliberately not ignored and continue to fail open to normal application verification.

### Deterministic saving

A Factory-only pull request goes from one duplicate Clean Project Lint impact runner to zero before any checkout occurs.

## Finding 2: Factory format evidence watches far more Python than it consumes

`factory-format-evidence.yml` previously triggered for `automation/**/*.py`, installed Python and the complete Factory development environment with uv, then copied, formatted, diffed and uploaded exactly one file: `automation/openhands_factory/daemon.py`.

Canonical Factory CI already runs Ruff format over the whole automation project. The standalone evidence workflow adds value only for its daemon-specific artifact, not for changes to router, pipeline, tests, prompts or other Python modules.

### Change

Its pull-request trigger is now scoped to `automation/openhands_factory/daemon.py` and the workflow file itself.

### Deterministic saving

Every Factory Python PR that does not modify `daemon.py` avoids one Python setup + uv dependency-sync + artifact runner. No formatting coverage is lost because canonical Factory CI still formats/checks the complete automation project.

## Finding 3: Dependency Review starts on dependency-free Factory diffs

The Dependency Review workflow previously ran on every pull request. Pure changes under `automation/openhands_factory/`, `automation/tests/`, `automation/prompts/`, Factory/systemd configuration, or documentation cannot change the repository dependency graph, yet still allocated a runner and executed Dependency Review against an empty dependency diff.

### Change

Those dependency-free Factory/control-plane paths are ignored at the pull-request trigger.

The ignore set intentionally does **not** include:

- `automation/pyproject.toml`;
- `automation/uv.lock`;
- GitHub workflow files;
- any application manifest or lockfile.

Python dependency changes and GitHub Actions dependency/reference changes therefore continue to run the vulnerability gate.

### Deterministic saving

A pure Factory code/test/prompt/config/docs PR goes from one Dependency Review runner to zero. Mixed changes continue to run automatically.

## Combined effect

For the common Factory PR shape that changes Factory Python/tests/docs without touching `daemon.py`, application dependencies, or workflows, these three changes remove up to **three standalone GitHub Actions runner allocations per PR** before setup or checkout work begins:

1. Clean Project Lint impact classifier: 1 -> 0;
2. Factory format evidence: 1 -> 0;
3. Dependency Review: 1 -> 0.

This does not alter the six-provider-start hourly allowance or reduce productive issue/review throughput. It removes control-plane work that cannot change the verdict for that class of PR.

## Safety boundaries preserved

The change does not alter:

- `CI / required`, which remains the only required CI status in the active `main` ruleset;
- Factory independent-review enforcement;
- full push and merge-queue validation;
- workflow lint for workflow/systemd changes;
- Factory Ruff, mypy and pytest verification;
- dependency review when manifests, locks or GitHub Actions can change;
- application lint for mixed or unknown diffs;
- exact-head review/merge safety;
- provider routing, retries, circuit breakers or allowance admission.

## Regression coverage

`automation/tests/test_factory_control_plane_efficiency.py` now locks all three trigger policies. The assertions deliberately check both the ignored Factory paths and the fail-open exclusions, so a future cleanup cannot silently skip `ci.yml`, the impact classifier, Python dependency files, uv lock state or workflow action changes.

## Next high-value work

The largest remaining deterministic control-plane cost is still the coupled GitHub discovery snapshot. With 3,801 issues and 182 PRs, a five-minute full scan processes up to 1,147,104 records per day at the current backlog size. The correct next step is source-scoped reconciliation:

- slow issue discovery in proportion to the one-issue-per-hour admission policy;
- faster PR/check reconciliation for review and merge responsiveness;
- source-specific retirement so a partial refresh cannot retire jobs from the other source;
- independent provider-health refresh rather than coupling health probes to backlog discovery.

That change should be implemented with explicit close/reopen, protected-worker, daemon-restart and stale-cache regression tests before changing production cadence.
