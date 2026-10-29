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

## 3. Incident task analysis and verified pipeline cause attribution

In the incident snapshot, six live tasks were stuck at spent repair budgets with bare terminal errors:

| Task ID | PR | State | Pre-repair error | Diagnostic cause identified | Blocking defect type |
|---------|----|-------|------------------|------------------------------|----------------------|
| 1478 | #9679 | `quality_repairing` | `Quality repair limit exceeded` | `Quality repair limit exceeded: design-sync-drift in scripts/design-sync-drift.mjs` | Design sync drift in script |
| 1397 | #9689 | `quality_repairing` | `Quality repair limit exceeded` | `Quality repair limit exceeded: review findings` | Independent review / local verification findings |
| 1437 | #9685 | `quality_repairing` | `Quality repair limit exceeded` | `Quality repair limit exceeded: review findings` | Independent review / local verification findings |
| 1584 | #9682 | `repairing` | `Repair limit exceeded` | `Repair limit exceeded: backend / test, frontend / test` | Backend and frontend unit/integration test failures |
| 9593 | #9593 | `repairing` | `Repair limit exceeded` | `Repair limit exceeded: CI / required` | Required CI status check failure |
| 9597 | #9597 | `repairing` | `Repair limit exceeded` | `Repair limit exceeded: CI / required` | Required CI status check failure |

### Pipeline execution verification

Rather than relying on synthetic manual assignments, the Factory pipeline (`FactoryPipeline.run_job()`) is directly tested in `automation/tests/test_pipeline.py` (`test_spent_budget_pipeline_emits_causes_for_incident_task_scenarios`) with jobs matching each of these failure configurations.

The test proves end-to-end that:
1. `pipeline.run_job()` halts without starting an agent (`_run_agent` is bypassed; 0 model invocations).
2. The pipeline autonomously generates and persists the exact diagnostic cause in `job.last_error`.
3. The pull request is parked via `_park_capped_pull_request` with the `factory-capped` label and notice comment.
4. `collect_incidents()` groups all tasks under the `exhausted-repair-budget` incident and populates every task's evidence row with its verified cause string.

## 4. Production baseline and post-deployment measurement protocol

### Production baseline (`elgansayer/elgl`, measured 2026-10-29)

- **Application merges:** 33 merges over 24 hours (1.375 merges/hour; 0 in 1h, 0 in 6h while the factory lane was paused at 9/8 WIP).
- **CI workflow runs per merged PR:** 2.07.
- **Factory WIP capacity:** 9/8 WIP (saturated by spent-budget pull requests, pausing all new task intake).
- **Repeated failures & backoff:** Unclassified or unescalated loops due to bare error strings lacking cause differentiation.
- **Model time:** Provider allowance burned on blind repair loops on unresolvable gates.

### Post-deployment measurement protocol and schedule

Following verified deployment to `main`, the autonomous maintenance loop (`maintenance.py`) automatically evaluates live outcomes over a 24-hour observation window (`deployed_at + timedelta(hours=24)`):

| Dimension | Baseline (pre-repair) | Post-deployment target & measurement method |
|-----------|-----------------------|---------------------------------------------|
| **Application merges** | 33 merges / 24h (paused at 9/8 WIP) | Rolling 24h throughput measured via `pr_metrics.py`. Capped PRs with exposed causes allow parking (#9702) and targeted drift guidance (#9701), unblocking the factory lane to resume new intake below 8 WIP. |
| **CI workflow runs / merge** | 2.07 runs / merged PR | Measured via `pr_metrics.py`. Terminal errors halt repair dispatch without pushing unverified heads, preventing unnecessary CI workflow triggers. |
| **Repeated failures** | Unescalated chronic backoff | Tracked via `FailureFingerprint.digest`. Deterministic prefixes and sorted identifiers ensure identical failures escalate backoff (5m -> 10m -> 20m -> 30m chronic floor), while tasks whose blockers change restart count. |
| **Model time** | Allowance burned on spent loops | Tracked via `MetricsStore`. Strictly 0 additional model invocations once budget cap is reached (`_run_agent` bypassed immediately). |
| **Diagnostic snapshot** | Bare error strings without causes | In the next scheduled maintenance snapshot, every `exhausted-repair-budget` evidence row names its blocking finding code and path, review findings, or sorted failed checks. |

## 5. Safeguards and rollback

- No repair limit is raised or relaxed: `MAX_CONSECUTIVE_QUALITY_REPAIRS = 5` and `repair_attempts = 5` remain strictly enforced.
- Rebuild mechanisms (`_restart_stale_unpublished` and `_rebuild_capped_conflict`) operate unchanged.
- Credential isolation, CI verification, and independent review requirements are fully preserved.
- Rollback: Reverting this commit cleanly restores the bare error strings with zero state or schema migrations needed.
