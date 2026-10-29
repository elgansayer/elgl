# Audit 2026-10-23: stale-snapshot merges, red main, CI-repair storm

Status words follow the factory convention: investigated, proposed, implemented, tested, submitted, reviewed, merged, deployed, verified, measured, scheduled, blocked.

## 1. System map (as audited 2026-10-23)

- **Repository:** `elgansayer/elgl`.
  - Rulesets require `CI / required` and `factory/independent-review`.
  - The owner (actor 6216372) has a `pull_request` bypass.
- **Factory instances:** systemd `repo-factory@hellotalk` and `repo-factory@workout-agent`.
  - State lives in `/var/lib/hellotalk-factory` (`jobs.json`, `leases.json`, `metrics.json`, `control.json`, and others).
- **Runtime:** venv `/opt/hellotalk-factory/venv-0.1.0`.
  - The effective `openhands_factory` import resolves to the shared checkout `/home/dev/hellotalk/automation`, which is an editable install (#9561).
  - Merged factory fixes therefore run only when that checkout contains them.
- **Release path:** `deploy.yml` runs on `workflow_run` of CI on `main`.
  - It builds the API and web images, scans the BuildKit digest with Trivy, attests provenance, and promotes `@digest` to `:latest`.
- **Providers:** routing is in `config/factory/agents.production.json`. It is google-first for most lanes and claude-first for code review, with codex last everywhere.

## 2. Baseline (main `85b9c407c`, measured 2026-10-23)

| Gate | Result on main |
|---|---|
| Last merge | 2026-10-20 18:58 UTC; red since |
| Backend unit | 69 failing files, 286 failing tests |
| Backend e2e | application does not boot (DI errors) |
| Frontend unit | does not compile |
| Node contracts | 3/16 |
| Factory pytest | 47 failing |
| Migration replay from zero | stops at migration #148 (uuid = text) |
| CI-repair lane | 1,529 model calls, about 78 provider-hours in 72 h, 0 code mutations |

### Post-repair measurements (2026-10-23)

| Metric | Before | After |
|---|---|---|
| main CI | red since 2026-10-20 18:58 UTC | green on `82f20b959` (17:20 UTC merge) and on `08ecf7e0d` |
| Merged PRs | 0 in about 70 h | 6 between 17:00 and 18:24 UTC |
| Repair calls (ci-repair plus quality-repair) | about 21 per hour, 0 mutations | +14 from 17:32 to 18:21 UTC (about 17 per hour); the window is too short to call a difference |
| "Repair limit exceeded" events | cap never reached (counter only moved on push) | 0 so far; the cap now counts model starts |
| Released images that start | none (API MODULE_NOT_FOUND; web served the nginx default page) | api and web at `08ecf7e0d` pass the live check |

## 3. Incident and root causes (investigated)

1. **Stale-snapshot merges.**
   - About 19 bot PRs whose commits were whole-tree snapshots of months-old sandboxes were merged on 2026-10-20 between 17:36 and 18:45 UTC, through the owner bypass.
   - For example, `547e96534` touched 553 files and deleted 44k lines.
   - Net effect: about −110k lines of reviewed work.
   - The "restore" PRs #9483 and #9492 restored from older snapshots and reverted more.
2. **Unbounded CI-repair loop** (`pipeline.py`):
   - The loop ran REPAIRING → model repair → local verify fails on inherited failures → QUALITY_REPAIRING → PR still CONFLICTING → back to REPAIRING.
   - `repair_attempts` was counted only after a push, so the cap of 5 never tripped.
3. **Contracts merged red.**
   - #8214 (accessible names), #7603 (fail-closed auth) and #7634 (Serious Learner mode) left their own contracts or e2e specs failing.
   - This was possible only because merges bypassed required checks.

## 4. Repair playbook: stale-snapshot damage (tested on this incident)

Tools are in `/home/dev/factory-tools/`. The guard is in the repository.

1. **Detect.**
   - Run `scripts/check-stale-snapshot.py --base <merge>^1 --head <merge>^2` for each suspect merge.
   - A path whose head blob equals an *older* base blob is a rollback.
   - Measured: flags 19/19 incident merges and 0/150 ordinary merges (2026-08-26 to 09-28).
2. **Pick the arbiter.**
   - Find the last fully green integrated run (here `06bcee016`). Restore the control plane from it, not from a "newest version per file" mix, which produced incoherent trees.
3. **Undo per merge, 3-way.**
   - Use `undo_file.sh <merge> <path>`: base = `M:p`, ours = current, theirs = `M^1:p`.
   - On conflict, keep the newer reviewed structure and re-add the lost behaviour by hand. Example: the visual harness kept #7819's desktop states and regained the mobile states.
4. **Replay legitimate commits.**
   - `replay_file.py <path> <base> <commits...>` rebuilds a file as base plus the reviewed changes made after it.
5. **Resolve conflicting designs with the newest reviewed decision, not the oldest test.**
   - Examples: #7634 (mode is not qualification), #7586 (computed serious-learner status), #1112 (`learning_goals` is TEXT).
   - Update stale tests or contracts to assert the same behaviour in the shipped form. Never delete coverage.
6. **Verify like CI.**
   - Set the `*_BASE_SHA` environment variables, or the constitution checks silently skip.
   - Strip ANSI codes before grepping `error TS`.
   - Run backend e2e, because unit tests do not exercise Nest DI wiring.
   - Regenerate Supabase types from a clean replay, and check that the previous snapshot hash reproduces at the old commit before trusting the diff.
7. **Label the repair PR `intentional-revert`**, so the guard reports it without blocking it.

## 5. Release and rollback procedure (verified 2026-10-23)

- **Release** (`deploy.yml`):
  - Build, then Trivy scan of `image@digest`, then attest, then promote `:latest` from `@digest`.
  - Each image also keeps an immutable `:<sha>` tag.
- **Live check after every release.** No hosted environment consumes `:latest`, so verify the published digest itself:
  1. API: `docker run --rm <api@digest> test -f dist/main.js`, and `docker run --rm -e NODE_ENV=production <api@digest>` must stop at "Production environment is missing required variables" (the fail-closed configuration check, which proves the module graph loads).
  2. Web: run it, then check that `/`, `/chat` and `/settings` return `<app-root>` (not "Welcome to nginx") and that the main bundle returns 200.
  3. Container CI enforces both checks since #9572.
- **Finding:** every release up to `82f20b959` failed the live check.
  - The API built to `dist/src/main.js`, so `node dist/main` threw MODULE_NOT_FOUND.
  - The web image served nginx's default page because the SSR shell is `index.csr.html`.
  - Fixed in #9572. First verified-working release: `08ecf7e0d`, api `sha256:6ff5a3ab4ef3557ef1c17559102d5e6a2bbc1a0558a04871d949d012f4279840`, web `sha256:81476f1573553f3ac568f3171476e3fc4121774633cd4d17473ad8e02b713039`.
- **Rollback.** The target is the most recent digest that **passed the live check**, not simply the previous digest. The previous digest before `08ecf7e0d` (`9693b8f3b`, api `sha256:d78d5964...`) cannot start.
  1. Confirm provenance: `gh api repos/elgansayer/elgl/attestations/<digest>`.
  2. Rehearse without pushing: `docker buildx imagetools create --dry-run --tag ghcr.io/elgansayer/elgl/api:latest ghcr.io/elgansayer/elgl/api@<digest>`. Rehearsed 2026-10-23: a valid OCI index was returned.
  3. Re-point for real (same command without `--dry-run`), do the same for `web`, then repeat the live check.
  4. Migrations in this window are additive (including `serious_learner_mode`, #9573), so no schema rollback is needed.

## 6. Prioritised backlog

| # | Item | Evidence | Benefit | Effort / risk | Verification | Rollback | Status |
|---|---|---|---|---|---|---|---|
| 1 | Merge the baseline repair (#9560) | main red since 2026-10-20 | unblocks all merges | large diff; normal review | main CI green on `82f20b959` | revert merge | merged, released |
| 2 | Run the factory from a non-editable install (#9561) | import resolved to the shared checkout | fixes actually reach the daemon | small | `python -I -c 'import openhands_factory'` resolves to site-packages | previous venv | done by the self-update timer 17:30 UTC; operator to confirm |
| 3 | Count model repairs at start (`298ef2276`) | 1,529 no-op calls in 72 h | caps a storm at 5 calls per job | small | regression tests red before, green after | revert commit | merged; deployed to the factory runtime 17:32 UTC |
| 4 | Stale-snapshot guard → required check (#9562) | 19/19 detected, 0/150 false positives | prevents a repeat | small; possible false positives | monitor advisory runs for 2 weeks | remove from ruleset | proposed |
| 5 | Owner bypass policy (#9562) | the incident used the bypass | prevents a repeat | governance | ruleset audit | restore bypass | proposed |
| 6 | Windowed provider metrics | `metrics.json` is cumulative and undated per row | makes routing decisions attributable | medium | per-day rows | n/a | proposed |
| 7 | Transport-failure circuit for codex lanes | see section 8 | fewer wasted calls | small (config) | failed calls per day | config revert | proposed |
| 8 | `serious_learner_mode` migration (#9563) | column missing from the corpus | preference persists | small | clean replay (193 migrations) plus types | additive | merged (#9573) |
| 9 | Lost behaviour (#9564) | mock clock, SCAN invalidation | restores features | medium | tests | revert | proposed |

## 7. Experiment ledger

| Date | Change | Hypothesis | Result | Status |
|---|---|---|---|---|
| 2026-10-23 | Pause the hellotalk factory (`control.json`) | stops the no-op repair storm while main is red | no new repair calls while paused | implemented; resume scheduled |
| 2026-10-23 | Mix the "newest version per file" | coherent tree | **failed**: `AgentPhase` NameError; replaced by restoring from `06bcee016` | abandoned |
| 2026-10-23 | Stale-snapshot detector threshold | low false-positive rate | threshold 2: 19/19 and 0/150 | measured |
| 2026-10-23 | Re-serialise JSON manifests and locales | simpler edits | **failed**: whole-file churn; replaced by textual insertion | abandoned |
| 2026-10-23 | `uv lock --upgrade-package pypdf` | narrow upgrade | **failed**: local uv re-resolved everything; replaced by splicing one package block | abandoned |

## 8. Model-routing evidence (investigated; no routing change made)

Source: `/var/lib/hellotalk-factory/metrics.json`, cumulative, recorded 2026-10-23 06:35 UTC. In total: 10,342 calls and 5,301 successful calls.

Caveat: "success" means the provider call completed, not that the task succeeded. For example, ci-repair shows 88% success with zero mutations. The rows carry no time window, so this cannot be attributed to the current routing order.

| Lane | Observation |
|---|---|
| implementation | codex 613 calls at 1.6% success (transport errors and rate limits); gemini-3.1-pro-high 32.7%; claude/sonnet 13.3% (quota) |
| quality-repair | codex 1,832 calls at 10.7% (1,406 transport failures); gemini-3.7-flash-low 67.2% |
| code-review | claude/sonnet 100% (97 calls); gemini-3.7-flash-low 99.2% (242); codex 10.3% |
| security-review | gemini-3.1-pro-high 85.2% (27 calls); claude/opus 30.9% (quota) |
| ci-repair | claude/haiku 88% (3,147 calls), but call completion hides zero task value during the storm |

Current config already orders codex last in every lane. Proposed next steps:

1. Make metrics windowed (backlog #6).
2. Add task-level outcome (did a mutation pass verification).
3. Only then trial cheaper lanes against a matched benchmark.

## 9. Schedules (confirmed by `atq` on the factory host, 2026-10-23 21:12 UTC)

| What | Mechanism | When | Expiry | Status |
|---|---|---|---|---|
| 24 h storm-fix measurement (repair dispatch rate, cap trips, merges) | `at` job 2, runs `/home/dev/factory-ops/measure-factory.py storm-24h` | 2026-10-24 17:35 UTC | one-shot | scheduled |
| 7-day routing evidence from `metrics-daily.json` (#9582) | `at` job 3, runs `measure-factory.py routing-7d` | 2026-10-30 18:00 UTC | one-shot | scheduled |

Both jobs are read-only and deterministic, with no model calls. The 2026-10-23 resume job was removed after the factory was resumed manually at 16:01 UTC.

First measurement, 17:32 to 21:12 UTC (3.7 h after the storm fix was deployed):
- 39 "Repair limit exceeded" cap trips (previously the cap never tripped).
- Repair dispatches at 19.4 per hour against a storm baseline of 21.2 calls per hour. These are not like-for-like, and the wave of PR refreshes after main turned green confounds the rate.
- 11 PRs merged.

No routing change is made until the 7-day evidence exists.

Resumable checkpoint (host-local): `/home/dev/factory-ops/CHECKPOINT.md`.
