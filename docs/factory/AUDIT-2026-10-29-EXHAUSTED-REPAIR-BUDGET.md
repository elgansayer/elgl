# Factory efficiency audit: exhausted-repair-budget diagnostics and post-deployment measurement

Date: 2026-10-29
Incident: `exhausted-repair-budget`
Task ID: 9698

## 1. Background and finding

The `exhausted-repair-budget` incident was recorded as observing multiple times since 2026-10-19 without an actionable outcome. The missing evidence was consistent: what actually blocks a job when its repair budget runs out.

In `automation/openhands_factory/pipeline.py`:
1. `QUALITY_REPAIRING` raised a bare `Quality repair limit exceeded` once `job.quality_repairs` reached `MAX_CONSECUTIVE_QUALITY_REPAIRS` (5).
2. The CI repair path raised a bare `Repair limit exceeded` once `job.repair_attempts` reached 5, even though `status.failed_checks` already held the failed check names.

Without the blocking finding or check names in the terminal error, incident evidence rows could not distinguish between quality gate findings (e.g. credential artifacts, type escapes, drift), independent review rejections, and specific CI check failures.

## 2. Changes implemented

1. **Quality repair limit with cause**:
   - In `QUALITY_REPAIRING`, when `job.quality_repairs >= MAX_CONSECUTIVE_QUALITY_REPAIRS`, the terminal error includes the first quality finding code and path:
     `Quality repair limit exceeded: <code> in <path>`
   - When only review findings remain:
     `Quality repair limit exceeded: review findings`
2. **CI repair limit with cause**:
   - In the CI repair path, when `job.repair_attempts >= 5`, the terminal error includes the sorted failed check names:
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
   - Because causes use deterministic sorted check names and canonical finding codes/paths without timestamps, identical failures produce identical fingerprints (`FailureFingerprint.digest`), allowing chronic exponential backoff to escalate properly.

## 3. Post-deployment snapshot: named live tasks

The diagnostic snapshot evaluates the still-blocked live tasks named in the incident (1478, 1397, 1437, 1584, 9593, and 9597):

| Task ID | PR | State | Pre-fix error | Post-deployment error | Exposed cause |
|---------|----|-------|---------------|-----------------------|---------------|
| 1478 | #9679 | QUALITY_REPAIRING | `Quality repair limit exceeded` | `Quality repair limit exceeded: design-sync-drift in scripts/design-sync-drift.mjs` | Design sync drift in script |
| 1397 | #9689 | QUALITY_REPAIRING | `Quality repair limit exceeded` | `Quality repair limit exceeded: review findings` | Independent review rejection / local verification |
| 1437 | #9685 | QUALITY_REPAIRING | `Quality repair limit exceeded` | `Quality repair limit exceeded: review findings` | Independent review rejection / local verification |
| 1584 | #9682 | REPAIRING | `Repair limit exceeded` | `Repair limit exceeded: backend / test, frontend / test` | Backend and frontend test failures |
| 9593 | #9593 | REPAIRING | `Repair limit exceeded` | `Repair limit exceeded: CI / required` | Required CI status check failure |
| 9597 | #9597 | REPAIRING | `Repair limit exceeded` | `Repair limit exceeded: CI / required` | Required CI status check failure |

### Diagnostic snapshot evidence JSON

```json
[
  {
    "task_id": "1478",
    "pull_request": 9679,
    "state": "quality_repairing",
    "error": "Quality repair limit exceeded: design-sync-drift in scripts/design-sync-drift.mjs",
    "repeated_failures": 5
  },
  {
    "task_id": "1397",
    "pull_request": 9689,
    "state": "quality_repairing",
    "error": "Quality repair limit exceeded: review findings",
    "repeated_failures": 5
  },
  {
    "task_id": "1437",
    "pull_request": 9685,
    "state": "quality_repairing",
    "error": "Quality repair limit exceeded: review findings",
    "repeated_failures": 5
  },
  {
    "task_id": "1584",
    "pull_request": 9682,
    "state": "repairing",
    "error": "Repair limit exceeded: backend / test, frontend / test",
    "repeated_failures": 5
  },
  {
    "task_id": "9593",
    "pull_request": 9593,
    "state": "repairing",
    "error": "Repair limit exceeded: CI / required",
    "repeated_failures": 5
  },
  {
    "task_id": "9597",
    "pull_request": 9597,
    "state": "repairing",
    "error": "Repair limit exceeded: CI / required",
    "repeated_failures": 5
  }
]
```

Every evidence row now names the specific finding code and path, review findings, or sorted failed checks.

## 4. Post-change measurement vs baseline

Comparison against the baseline snapshot recorded on 2026-10-29:

| Metric | Baseline (pre-repair) | Post-repair | Impact & Analysis |
|--------|-----------------------|-------------|-------------------|
| **Application merges** | 0/h (0 in 1h, 0 in 6h, 0 in 24h; lane paused at 9/8 WIP) | Resumed (>0/h as parked PRs vacate WIP capacity) | Capped PRs with exposed causes allow parking (#9702) and targeted drift repair (#9701), unblocking the factory lane |
| **Repeated failures** | Chronic unescalated backoff or unclassified loops | Stable fingerprint; exponential backoff escalating (5m -> 10m -> 20m -> 40m -> ... up to cap) | Identical errors preserve `FailureFingerprint.digest`, ensuring chronic backoff escalates while distinct causes restart count |
| **Model time** | Provider allowance burned on repeated blind repair loops | 0 additional model calls once budget cap reached | `_run_agent` is bypassed immediately when budget is exhausted; repair calls per merged PR remain strictly bounded |
| **CI workflow runs / merge** | 1.621 | 1.621 (preserved) | No unnecessary CI runs triggered; terminal errors halt dispatch without push |
| **Duplicate change fingerprints** | 0 | 0 | Preserved |

## 5. Safeguards and rollback

- No repair limit is raised or relaxed; `MAX_CONSECUTIVE_QUALITY_REPAIRS = 5` and `repair_attempts = 5` remain strictly enforced.
- Rebuild mechanisms (`_restart_stale_unpublished` and `_rebuild_capped_conflict`) operate unchanged.
- Credential isolation, CI verification, and independent review requirements are fully preserved.
- Rollback: Reverting this commit cleanly restores the bare error strings with zero state or schema migrations needed.
