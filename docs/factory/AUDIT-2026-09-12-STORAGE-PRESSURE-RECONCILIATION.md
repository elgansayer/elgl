# Factory storage-pressure reconciliation audit - 2026-09-12

## Finding

The live Factory control panel showed a healthy daemon and watchdog but zero active jobs while 2,350 jobs were runnable. The Factory-state volume had 3.9 GiB free against the 5 GiB scheduling reserve. Existing recovery-archive and host/container cleanup correctly run outside the scheduling gate, but GitHub refresh and stale-worktree reconciliation still ran only when the storage gate was already green.

That left a circular recovery gap: clean worktrees belonging to issues or pull requests that had since closed could be one of the causes of low free space, while low free space prevented the reconciliation pass that proves those worktrees stale and removes them.

## Change

- While storage is below reserve, the daemon performs a deterministic control-plane reconciliation at most every 15 minutes. It does not start providers, implementation, review, repair, verification, merge work, or the architect cycle.
- Pressure-mode reconciliation may remove only stale worktrees proven clean. Dirty or unreadable stale worktrees are preserved in place and are not copied into recovery storage while the filesystem is already constrained. Normal reconciliation later archives them once storage recovers.
- The production admission-aware issue cache is bypassed during pressure reconciliation so closed issues are observed authoritatively. This does not admit new issues because scheduling remains storage-gated.
- Active worker task IDs remain protected exactly as in normal reconciliation.

## Expected efficiency and recovery impact

This change does not claim a token percentage. Its direct effect is to let the Factory reclaim provably disposable clean worktrees without any model call when storage itself is blocking all 2,350 currently runnable jobs. If stale clean worktrees account for the roughly 1.1 GiB shortfall visible on 2026-09-12, one pressure reconciliation can restore the reserve and resume useful engineering throughput. If they do not, the Factory stays fail-closed and the existing host-storage controls remain authoritative.

The 15-minute pressure cadence bounds GitHub discovery cost while still making recovery far faster than an operator-only intervention. Normal issue discovery keeps its admission-aware cache and normal scheduling cadence.

## Safety

No provider routing, retry, concurrency, model, prompt, verification, security-review, independent-review, reviewed-SHA, CI, mergeability, or exact-head merge guarantee is weakened. Dirty work is never deleted to recover space, and no model-backed phase can start below the storage reserve.

## Validation

Regression coverage proves that pressure reconciliation removes a clean closed worktree, preserves a dirty closed worktree without creating another recovery archive, propagates the pressure mode through the daemon control-plane helper, and forces authoritative issue discovery during storage pressure even when new-issue admission is full. Canonical GitHub CI remains authoritative for Ruff, mypy, pytest, workflow policy, and repository-wide checks.
