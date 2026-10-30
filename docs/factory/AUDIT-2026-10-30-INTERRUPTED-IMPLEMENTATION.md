# Factory efficiency audit: interrupted implementations and the no-change check

Date: 2026-10-30
Incident: `ineffective-agent-repair` (recovery 5)
Task ID: 9730
Affected tasks: 1195, 1746, 1752

## 1. Background and finding

The maintenance snapshot of 2026-10-30 shows three jobs in `implementing` with no pull request, each failing with `Agent provider 'codex' failed: Implementation produced no changes`:

| Task | Attempts | Repetitions |
| ---- | -------- | ----------- |
| 1195 | 8        | 6           |
| 1746 | 5        | 5           |
| 1752 | 1        | 1           |

This is a shared retry loop, not a daemon crash: `watchdog.recovered_total` is 0.

The finding is a hypothesis, not a verified root cause. The snapshot does not include each worktree's `git status`, so it cannot prove that these three worktrees are dirty. There is an alternative explanation: the issue may already be resolved on `main`, in which case a clean tree is the correct result and this change has no effect on it.

## 2. Mechanism

In `automation/openhands_factory/pipeline.py`, `FactoryPipeline._run_agent` guards a phase that must change the repository with a hook pair:

1. `prepare()` records `baseline_fingerprint = workflow.change_fingerprint()`. The router calls it before every provider attempt, including the same-provider retry and each fallback provider (`AgentRouter._run_routed`).
2. `validate()` raised `AgentTaskFailure("<Phase> produced no changes")` when the fingerprint after the attempt equalled the baseline.

`GitWorkflow.change_fingerprint` was designed for repair phases: its docstring notes that repairs often start with an already-dirty implementation, so the comparison is against the starting state and not against `HEAD`. The `IMPLEMENTING` branch of `_advance` is the only caller that passes the `implementation` phase, and it used the same comparison.

That leaves a gap for an interrupted implementation:

1. Attempt N edits the claimed worktree and then ends on a provider rate limit, transport failure or timeout. The codex implementation lifetime record holds 231, 232 and 24 of these.
2. The job stays in `IMPLEMENTING`. Nothing resets or cleans the worktree between retries: it is created once, on the `DISCOVERED` to `IMPLEMENTING` transition (any stale one is archived and removed first), and every retry reuses it.
3. Attempt N+1 records a baseline that already includes the leftover edits. A provider that finds the task done makes no further edit, the fingerprint is unchanged, and the attempt fails with `Implementation produced no changes`. Every later retry repeats this.

The edits never reach security review, verification, the quality gate, independent review or CI, so nothing downstream ever judges whether they are right. The same sequence happens inside one routed run when the first provider edits and fails and a fallback provider finds nothing more to do.

## 3. Change implemented

In `FactoryPipeline._run_agent`, narrowed to the `implementation` phase:

- `prepare()` also records whether the worktree already differs from `HEAD` (`GitWorkflow.has_changes`, which counts tracked edits, deletions and untracked files and honours the ignore rules).
- When it did, `validate()` accepts the attempt if the worktree still differs from `HEAD` afterwards. It does not demand a further fingerprint change.
- When the worktree was clean, the existing fingerprint comparison is untouched, so an unchanged clean tree still raises `Implementation produced no changes`.
- `quality_repair` and `repair` never take the new branch and keep the strict comparison.
- A provider that discards all of the leftover edits leaves a tree identical to `HEAD`, so it is rejected as producing no changes. Previously the changed fingerprint accepted it, a security review ran on an empty diff, and the job then kept failing in `VERIFYING` on `No changed paths were found` instead of retrying implementation.

Security review, `VERIFYING`, the quality gate, independent review and CI are unchanged. Leftover edits are judged by them exactly as new edits are.

## 4. Verification boundary

The regression tests use a real one-commit Git repository for the worktree, so change detection is Git behaviour and not a stubbed fingerprint:

1. Leftover edits (a tracked edit, an untracked file, a tracked deletion) with a provider that changes nothing advance to `SECURITY_REVIEW` without `Implementation produced no changes`, attempt count reset and the edits still in the worktree. On the previous code these fail with that error.
2. The incident mechanism end to end: a provider edits the worktree and drops its connection, and the same-provider retry, which finds the work done, is accepted. On the previous code the retry fails with `Implementation produced no changes`.
3. A clean worktree with a provider that changes nothing still fails with `Implementation produced no changes` and stays in `IMPLEMENTING`.
4. A provider that discards the leftover edits fails the same way.
5. `quality_repair` and `repair` still raise `produced no changes` on an already-dirty worktree, and `test_quality_repair_that_changes_nothing_still_spends_the_budget` passes unchanged.
6. `GitWorkflow.has_changes` is pinned against a real repository: edits, new files and deletions count, and a git-ignored symlinked dependency cache does not, so a fresh worktree reads as clean.

Three older tests ran an implementation attempt in a plain directory with only the fingerprint stubbed. They now also state that the worktree is clean (`has_changes` returns `False`), which is the premise they already had. Deliberately weakening the change in three ways, widening it to all phases, treating every attempt as resuming, and accepting on the starting state alone, each makes at least one test fail.

These tests prove the contract and reproduce the mechanism. They do not prove that the live worktrees of tasks 1195, 1746 and 1752 are dirty. Only a post-deployment snapshot can show that, and no test fixture is presented as a production observation.

## 5. Production baseline and post-deployment measurement protocol

### Baseline (`elgansayer/elgl`, observed 2026-10-30T14:04:24Z)

- **Jobs:** 3 in `implementing`, 7 in `quality-repairing`, 9 in `repairing`, 5 in `pr-draft`, 1 in `reviewing`.
- **Application merges:** 17 in the last 24 hours (0.708 per hour; 5 `automation` and 12 `multi`), 7 in 6 hours (1.167 per hour), 2 in 1 hour.
- **Per merged pull request:** 2.652 repair model invocations, 2.365 CI workflow runs, 0.331 reviewer model invocations.
- **Codex implementation, lifetime:** 663 calls, 21 successes and 642 failures (`provider_auth` 76, `provider_rate_limit` 231, `provider_timeout` 24, `provider_transport` 232, `task_failure` 79), about 159,975 seconds of model time, 0.008 successful outputs per model minute. `task_failure` covers every task-side failure, not only no-change ones.

### Per-task outcome (to be recorded by the maintenance controller)

For 24 hours after verified deployment, report for each of tasks 1195, 1746 and 1752 separately:

| Task | New `Implementation produced no changes` errors | `implementing` to `security-review` or `verifying` transitions |
| ---- | ----------------------------------------------- | -------------------------------------------------------------- |
| 1195 | not yet observed                                | not yet observed                                               |
| 1746 | not yet observed                                | not yet observed                                               |
| 1752 | not yet observed                                | not yet observed                                               |

Reading the result, per task:

- The job leaves `implementing`: consistent with leftover edits having blocked it. This is observational, not causal.
- The job still records `Implementation produced no changes`: its worktree was clean when the attempt started, which falsifies the hypothesis for that task. The likelier explanation is then an issue already resolved on `main`, and this change correctly has no effect on it.

### Effect measurements

| Dimension              | Baseline                                                                      | After deployment                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Application merges** | 17 per 24 hours (0.708 per hour)                                              | Rolling 24-hour throughput from `pr_metrics.py`. Do not attribute a change to this fix unless one of the three tasks reaches a merged pull request. |
| **Repeated failures**  | Attempts 8, 5 and 1; repetitions 6, 5 and 1                                   | Persisted failure fingerprints and repetition counts for the three jobs.                                                                         |
| **Model time**         | Implementation provider seconds already spent on the three jobs               | Implementation seconds per job from `MetricsStore`, plus any security-review and repair calls the resumed edits then cause. Report both.         |

A resumed edit that the later gates reject spends repair model time that the old loop did not reach. That is the intended trade: the old loop spent implementation calls and never produced anything for a gate to judge.

## 6. Safeguards and rollback

- No budget, gate, review or CI requirement is relaxed. Leftover edits get the same security review (unless tests-only merging applies), verification, quality gate, independent review and required CI as any other edit.
- A clean worktree and both repair phases keep the strict check, so a provider that does nothing is still never counted as work.
- Credential isolation is unchanged: the new check runs two additional local `git status` calls at most, with the same scoped Git environment, and starts no model session.
- Rollback: revert the single commit. No job state, budget or ledger needs resetting.
