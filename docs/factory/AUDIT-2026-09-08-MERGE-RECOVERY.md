# Factory merge recovery efficiency audit - 2026-09-08

## Scope

This pass re-read the current Factory merge/review control plane, provider admission, prompt/output observability, retry/concurrency limits, GitHub discovery cadence, and scheduled recovery workflows on current `main`.

The normal merge path remains daemon-owned and exact-head protected. The standalone `Factory Merge Gate` workflow is a recovery path for daemon downtime or missed control-plane progress, not the healthy-path merger.

## Finding: recovery polling waits even when the authoritative event already exists

The recovery workflow ran every hour even when nothing was mergeable. At the same time, every merge to `main` already triggers canonical `CI`, and the workflow refuses recovery merging unless the current `main` SHA has a successful canonical `CI` push run.

That means a successful `CI` push run on `main` is both necessary evidence and a natural event for the next recovery attempt. Polling hourly after that evidence exists adds latency during a backlog, while polling hourly when it does not exist allocates runners that can only exit.

## Change

`Factory Merge Gate` now reacts to completed `CI` workflow runs on `main`, but only executes the merge job when the triggering run is a successful `push` run. Pull-request and merge-queue CI cannot authorize recovery merging.

The existing current-main fence remains in place: the workflow independently re-queries canonical `ci.yml` push runs and exits unless the exact current `main` SHA is green. It still selects only one clean, non-draft `factory-reviewed` PR whose `factory/independent-review`, `CI / required`, and complete status rollup are successful, and still uses `--match-head-commit`.

The schedule is retained only as a missed-event/daemon-downtime backstop and reduced from hourly to every six hours.

## Expected efficiency and throughput effect

Scheduled recovery starts fall from 24/day to 4/day, an 83.3% reduction in unconditional scheduled allocations (20 fewer scheduled starts/day, up to 7,300/year).

During a genuine recovery backlog, the next eligible PR can be attempted immediately after the preceding merge's canonical `main` CI succeeds instead of waiting up to an hour for the next poll. The one-merge-per-green-main safety invariant is preserved, so recovery throughput improves without batch-merging PRs against a stale base verdict.

Event-driven runs are proportional to real successful `main` CI completions rather than wall-clock polling. They do not start an AI/provider session and therefore do not consume model subscription allowance.

## Safety boundaries preserved

- the Factory daemon remains the healthy-path merge owner;
- current `main` must have successful canonical push CI;
- only one eligible PR is selected per recovery run;
- exact PR head SHA matching remains required;
- `factory/independent-review` and `CI / required` remain mandatory;
- drafts, merge-conflicted PRs, changes-requested PRs, and incomplete/failing checks remain excluded;
- manual dispatch remains available;
- the six-hour schedule remains as a recovery backstop if a workflow event is missed.

## Validation

`automation/tests/test_factory_efficiency_contract.py` now locks the event source, successful-main-push guard, six-hour backstop, exact-head merge, canonical-main CI fence, and review/CI status requirements. Repository workflow lint and canonical Factory/CI validation remain authoritative for the published PR head.

## Deferred larger optimization

The largest remaining deterministic GitHub control-plane cost is still the coupled five-minute full issue + PR discovery snapshot documented in the 2026-08-31 efficiency audit. Splitting issue discovery from PR reconciliation remains worthwhile, but should land only with source-scoped retirement/cache tests so a partial snapshot can never retire durable work from the other source. This pass does not trade lifecycle correctness for that saving.
