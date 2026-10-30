# Factory efficiency audit: exhausted-repair-budget diagnostics and post-deployment measurement

Date: 2026-10-29
Incident: `exhausted-repair-budget`
Task ID: 9698

## 1. Background and finding

The `exhausted-repair-budget` incident was recorded as observing multiple times since 2026-10-19 without an actionable outcome. The missing evidence was consistent: what actually blocks a job when its repair budget runs out.

In `automation/openhands_factory/pipeline.py`:
1. `QUALITY_REPAIRING` raised a bare `Quality repair limit exceeded` once `job.quality_repairs` reached `MAX_CONSECUTIVE_QUALITY_REPAIRS` (5).
2. The CI-repair path raised a bare `Repair limit exceeded` once `job.repair_attempts` reached 5, even though `status.failed_checks` already held the failed check names.

The `VERIFYING` path already raised `Quality gate blocked: {code} in {path}`. Without equivalent blocking finding or check names in the terminal errors for `QUALITY_REPAIRING` and `REPAIRING`, incident evidence rows could not distinguish between quality-gate findings (e.g. credential artifacts, type escapes, design sync drift), independent review rejections, and specific CI check failures.

## 2. Changes implemented

1. **Quality repair limit with cause**:
   - In `QUALITY_REPAIRING`, when `job.quality_repairs >= MAX_CONSECUTIVE_QUALITY_REPAIRS`, the terminal error includes the first quality finding code and path:
     `Quality repair limit exceeded: <code> in <path>`
   - When only review findings remain:
     `Quality repair limit exceeded: review findings`
2. **CI repair limit with cause**:
   - In the CI-repair path, when `job.repair_attempts >= 5`, the terminal error includes the sorted failed check names:
     `Repair limit exceeded: <sorted failed check names>`
   - When no check is reported:
     `Repair limit exceeded: no failed check reported`
3. **Safety and bounded cause strings**:
   - Only stable identifiers are included: no evidence text, timestamps, or SHAs.
   - Check names and paths are bounded via `MAX_BUDGET_CAUSE_ITEMS` (8) and `MAX_BUDGET_CAUSE_ITEM_CHARS` (200), ensuring the error string stays well within `Job.last_error` limits (2000 characters).
4. **Failure classification and incident grouping**:
   - `is_repair_budget_exhausted(detail)` in `retry_policy.py` matches prefix strings (`repair limit exceeded`, `quality repair limit exceeded`).
   - `classify_failure` reliably classifies all spent-budget errors as `FailureKind.BUDGET`.
   - `failure_family` in `maintenance.py` checks `is_repair_budget_exhausted` first so that check names mentioning other families (e.g. `fonts.googleapis.com` or `design-sync-drift`) do not misclassify the failure family.
5. **Fingerprint stability**:
   - Because causes use deterministic sorted check names and canonical finding codes and paths without timestamps, identical failures produce identical fingerprints (`FailureFingerprint.digest`), allowing chronic exponential backoff to escalate properly.
6. **Integration with PR parking**:
   - Integrates with `_park_capped_pull_request` (#9702) so capped pull requests are labeled `factory-capped` and commented with the last error evidence, removing them from WIP counts without closing them.

## 3. Verification boundary

Focused pipeline tests prove the implementable contract for representative quality-gate,
review-only and CI failures. They verify that the pipeline:

1. halts without starting an agent after the relevant budget is spent;
2. persists a stable cause in `job.last_error`;
3. publishes that same cause in the one-time capped pull-request notice; and
4. retains stable failure classification, incident grouping and retry fingerprints.

These tests do not identify the live blockers for tasks 1478, 1397, 1437, 1584, 9593
or 9597. Only a post-deployment maintenance snapshot can provide that evidence. No
test fixture or substituted GitHub status is presented as a production observation.

## 4. Production baseline and post-deployment measurement protocol

### Production baseline (`elgansayer/elgl`, measured 2026-10-29)

- **Application merges:** 33 merges over 24 hours (1.375 merges/hour; 0 in 1h, 0 in 6h while the factory lane was paused at 9/8 WIP).
- **CI workflow runs per merged PR:** 2.07.
- **Factory WIP capacity:** 9/8 WIP (saturated by spent-budget pull requests, pausing all new task intake).
- **Repeated failures & backoff:** Unclassified or unescalated loops due to bare error strings lacking cause differentiation.
- **Model time:** Provider allowance burned on blind repair loops on unresolvable gates.

### Post-deployment measurement protocol and schedule

Following verified deployment to `main`, the autonomous maintenance loop (`maintenance.py`) automatically evaluates live outcomes over a 24-hour observation window (`deployed_at + timedelta(hours=24)`):

| Dimension | Baseline (pre-repair) | Post-deployment measurement |
|-----------|-----------------------|-----------------------------|
| **Application merges** | 33 merges / 24h (paused at 9/8 WIP) | Record the rolling 24-hour throughput from `pr_metrics.py`. |
| **CI workflow runs / merge** | 2.07 runs / merged PR | Record the 24-hour value from `pr_metrics.py`. |
| **Repeated failures** | Bare errors did not distinguish blockers | Compare persisted failure fingerprints and repetition counts for the affected jobs. |
| **Model time** | Allowance was spent on repair attempts before the cap | Compare provider usage from `MetricsStore`; a capped dispatch must add no model invocation. |
| **Diagnostic snapshot** | Bare error strings without causes | Inspect live `exhausted-repair-budget` evidence rows for the named tasks that remain blocked. |

The maintenance controller records the baseline at issue creation, waits for verified
deployment, and stores an outcome snapshot after 24 hours. Until that observation exists,
the effect on merges, repeated failures and model time remains unverified.

## 5. Safeguards and rollback

- No repair limit is raised or relaxed: `MAX_CONSECUTIVE_QUALITY_REPAIRS = 5` and `repair_attempts = 5` remain strictly enforced.
- Rebuild mechanisms (`_restart_stale_unpublished` and `_rebuild_capped_conflict`) operate unchanged.
- Credential isolation, CI verification, and independent review requirements are fully preserved.
- Rollback: Reverting this commit cleanly restores the bare error strings with zero state or schema migrations needed.
