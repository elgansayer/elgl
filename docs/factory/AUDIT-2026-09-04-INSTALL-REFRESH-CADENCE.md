# Factory efficiency audit: fresh-install refresh cadence

Date: 2026-09-04

## Finding

Both production Factory instance profiles use `FACTORY_COOLDOWN_SECONDS=300`, while the canonical `config/systemd/factory.env.example` still used `60`. `setup-debian.sh` copies that template verbatim when `/etc/hellotalk-factory/factory.env` does not already exist, so a fresh or legacy-style host install could silently return to one full GitHub control-plane refresh per minute.

Issue admission is independently limited to one newly discovered issue per hour. The source-scoped refresh optimisation also avoids repeated full issue discovery while that admission window is full. A 60-second general refresh therefore does not increase useful issue implementation throughput; it primarily increases pull-request reconciliation, health/source checks, and GitHub CLI/API traffic compared with the deployed five-minute production cadence.

## Change

The fresh-install template now uses the same 300-second refresh interval as both production instance profiles. Regression coverage reads the template and production profiles and locks the five-minute cadence while preserving the invariant that issue-admission windows are no shorter than the refresh period.

No existing `/etc` file is overwritten by this change. Existing production instance profiles are unchanged; this prevents future installs from regressing to the older one-minute default.

## Expected efficiency impact

For a host created from the canonical template, the maximum general refresh frequency falls from 1,440 to 288 cycles per day, an 80% reduction. Useful new-issue admission remains capped at one per hour, and active jobs continue to run from durable local state between source refreshes.

This is a control-plane/API and host-work saving. It does not claim a provider-token percentage because subscription-provider starts are governed separately by the Factory's durable route budget and the CLIs do not expose one portable token counter.

## Safety invariants

Unchanged:

- one-new-issue-per-hour production admission;
- active PR/job progress from durable state;
- provider routing and fallback order;
- provider-start and per-task route budgets;
- concurrency limits and first-failure circuits;
- deterministic verification and mechanical repair;
- security review, independent review, reviewed-SHA protection, and required merge checks;
- autonomous retry/backoff behavior.
