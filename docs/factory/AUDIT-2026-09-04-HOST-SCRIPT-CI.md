# Factory efficiency audit: host-only scripts should not run the product matrix

Date: 2026-09-04

## Finding

The canonical pull-request impact classifier already treats `automation/**`, `config/factory/**`, `config/systemd/**`, and the Factory-only workflows as control-plane changes. Factory host lifecycle scripts under `scripts/` were still falling through the unknown/shared-path branch, which deliberately requests application verification.

That fallback is correct for an arbitrary script, but it is unnecessarily expensive for the small, explicit set of scripts whose only purpose is installing, starting, repairing, migrating, or maintaining the autonomous Factory and its subscription-provider state.

A current example is PR #8788. Its diff contains `scripts/maintain-factory-host-storage.sh` alongside Factory Python/config/systemd/docs changes. The canonical CI run therefore allocated all ten product matrix jobs: backend lint/build/unit/e2e, frontend static-analysis/build/unit, and admin-portal lint/build/unit. Each matrix job independently checks out the repository, sets up Node, and runs `npm ci` before its product check. The Factory job was also correctly run.

The host-storage script cannot modify backend, frontend, or admin application behavior. Running those ten application jobs therefore adds runner allocation, dependency installation, queue pressure, and merge latency without adding verification signal for that path.

## Change

The shared classifier now recognizes only the existing, explicitly named Factory host-management scripts as Factory-only paths:

- `scripts/decommission-legacy-factory.sh`
- `scripts/deploy-and-start-factory.sh`
- `scripts/install-factory-env.sh`
- `scripts/install-repo-factory-instance.sh`
- `scripts/maintain-factory-host-storage.sh`
- `scripts/migrate-factory-to-secondary-disk.sh`
- `scripts/relocate-home-cache-to-second-disk.sh`
- `scripts/repair-factory-host.sh`
- `scripts/start-factory.sh`

An arbitrary or future script still fails open to application verification. A mixed diff containing any application-impacting path still runs both Factory and application verification.

Changes to `scripts/classify-ci-impact.sh` or its regression test now explicitly fail open to both verification groups. This audit PR therefore self-validates the optimization rather than benefiting from the skip it introduces.

## Expected efficiency impact

For a pull request whose only executable changes are in the existing Factory control plane and one or more of the allowlisted host scripts, the canonical CI workflow no longer allocates the ten application matrix jobs. Factory verification still runs.

This is a GitHub Actions/throughput saving, not a claimed provider-token percentage. It complements the existing provider-start, review, retry, concurrency, prompt-size, and issue-admission controls by removing unrelated verification work from Factory infrastructure changes.

## Safety invariants

Unchanged:

- unknown/shared paths fail open to application verification;
- mixed Factory/product diffs run both verification groups;
- classifier/gate changes fail open to both verification groups;
- Factory Ruff format/lint, mypy, and pytest remain required whenever a Factory path is present;
- constitution/governance checks and the canonical `CI / required` gate remain intact;
- security review, independent review, reviewed-SHA protection, mergeability, and branch protection are unchanged;
- no provider route, model tier, reasoning effort, retry, failover, recovery, quarantine compatibility, or task scheduling behavior changes;
- no human interaction or manual recovery state is introduced.

## Regression coverage

`scripts/classify-ci-impact.test.sh` now verifies:

- every allowlisted host script is Factory-only;
- mixing a host script with product source requests both lanes;
- unknown scripts still fail open to application verification;
- classifier and classifier-test self changes request both lanes;
- the existing empty-diff fail-open behavior remains intact.
