# Factory source-scoped refresh efficiency audit - 2026-08-31

This audit looked for another high-confidence way to reduce Factory control-plane work without weakening engineering verification, review independence, autonomous recovery, or merge protection.

## Finding

Production intentionally admits only one newly discovered GitHub issue per hour, while the normal control-plane refresh runs every five minutes so existing pull requests can keep moving through review, CI, repair, and merge state changes.

Before this change, every five-minute refresh coupled those two very different freshness requirements. `FactoryPipeline.refresh()` fetched the complete open issue backlog and the open pull-request set together even when the durable issue-admission window was already full and no new issue could be scheduled.

At the audit snapshot the repository had 3,801 open issues and 182 open pull requests. A five-minute cadence permits 288 refreshes per day. Fetching all open issues on every one of those cycles can therefore materialize up to 1,094,688 issue records per day even though production can admit at most about 24 newly discovered issues in the same period.

## Change

The production `MainCiGatedFactoryDaemon` now makes issue discovery admission-aware while leaving pull-request reconciliation on the existing five-minute cadence.

When a new-issue admission slot is available, the next normal refresh performs the full GitHub issue scan before scheduling. When the admission window is already full, the refresh reuses the durable cached `github-issue` tasks and still performs the normal fresh pull-request scan. If issue admission limiting is disabled, behavior remains unchanged and every refresh performs a full issue scan.

Under the current one-per-hour production admission policy, a persistently busy Factory can reduce full issue-list scans from up to 288 per day to about 24 per day. At the audit snapshot that is approximately 91,224 issue records instead of 1,094,688, a steady-state upper-bound reduction of 1,003,464 issue records per day, or about 91.7%. Pull-request refresh frequency is unchanged.

These are deterministic control-plane record counts, not claimed provider-token savings. The main benefit is less repeated GitHub serialization, parsing, durable cache rewriting, and reconciliation work while preserving scarce subscription capacity for engineering work.

## Safety and autonomy invariants

The optimization does not create a quarantine, pause, or manual-triage state. Existing issue jobs stay durably cached and schedulable. A newly opened admission slot always causes a fresh GitHub issue scan before another discovered issue can be admitted, so a cached issue that closed while admission was full cannot consume the newly available slot.

Pull requests remain freshly reconciled every normal control-plane cycle, so review, CI, repair, and merge throughput do not inherit the one-hour issue-discovery cadence. Active worker task IDs remain protected by the existing reconciliation fence.

The change does not alter provider routing, model or reasoning-effort selection, retry/failover policy, failure backoff, duplicate-work ownership, security review, verification, quality repair, independent review, reviewed-SHA protection, `factory/independent-review`, `CI / required`, current-main gating, mergeability checks, or branch protection.

## Regression coverage

Focused tests lock three cases:

- while issue admission is full, the daemon reuses only cached GitHub issue tasks and does not invoke the remote issue collector;
- when an admission slot opens, the daemon immediately returns to a fresh GitHub issue scan;
- when issue admission limiting is disabled, the original full-scan behavior remains intact.

GitHub Actions on the pull-request head remains authoritative for Factory format, Ruff, mypy, pytest, constitution, and required merge checks.
