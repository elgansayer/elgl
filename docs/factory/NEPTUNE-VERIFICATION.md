# Neptune verification integration

This is a preparatory verification planner for `elgansayer/Neptune-Bomberman`.
It reuses Repo Factory's worktree provisioning, dependency links, host-resource
gate and credential-free verification namespace. It does not start a third
daemon or change the running Elgl/workout instances.

`commands_for(repository, paths, "neptune")` delegates to Neptune's
`tools/factory/verify.py`. That CLI shares its path classifier, command builder
and required-result validation with Neptune's required CI. Metadata/runner/game
changes require 5/8/10 checks. Native selections require a coordinator-provisioned
offline Godot cache and matching native addon hashes. Verification never downloads
a missing engine. Unsupported/empty paths fail rather than selecting Elgl checks.

The primary canonical clone contains `.git` and ignored `.factory-tools/godot`.
The ordinary GitWorkflow links `.factory-tools` into its worker worktrees, as it
already links other dependency caches. Their Git metadata must belong to this
canonical clone; an unrelated worktree's common Git directory is not restored
inside the namespace. Canonical sources/cache are read-only; only the current
worker checkout is writable. Every verification attempt uses a fresh evidence
directory. Executable/unknown changes take the existing host-exclusive lane.

Exit zero alone is insufficient. The host verifier requires one structured
`neptune.factory-verification.v1` receipt matching the requested files, recognised
applicable check identities, source identity and literal successful command/exit
records. Empty, duplicate, stale-selection, skipped, timed-out and failed receipts
are rejected. Local receipts never claim to be GitHub statuses or review approvals.

## Boundary hardening discovered during onboarding

A harmless synthetic host-home canary was visible through the deployed verifier:
setting HOME to a temporary directory did not block absolute-path access. The
updated namespace stages permitted sources first, then masks `/home`, `/root`,
coordinator configuration directories and both legacy/shared state/log roots.
It restores only the allowed worktree, read-only canonical checkout and explicitly
staged dependency caches. No actual credential was accessed during the probe.

The patched canary hides the synthetic file, preserves the worktree and exposes
only loopback networking. A separate probe verifies that the pinned Godot binary
starts inside the namespace and the linked cache rejects writes. Existing unit
coverage remains; regression tests pin staging/masking order and receipt failures.

## Activation remains disabled

FactoryConfig deliberately still accepts only the existing `hellotalk` and
`workout-agent` live profiles. A test pins rejection of live `neptune` activation.
Before enabling it, implement Neptune's distinct tests-only lifecycle/merge policy
without weakening the independent-review requirements of existing repositories.
Preserve Neptune's current-base app-pinned required check and merge ancestry.

Then stage an instance with separate state/workspaces/GitHub permissions and the
existing shared subscription-provider capacity/health/budget policy. Reconcile
manually running Codex/Gemini sessions, run one bounded issue through merge, test
restart/quota recovery, and only then enable continuity. These verification
changes and synthetic tests do not establish that live acceptance.

Tracked scope: Neptune #33/#474, verification #75/#76 and isolation #84. Merge
policy integration remains #77. Provider limits and spend are not increased.

## Preparatory GitHub merge boundary

GitHubClient recognises the exact `elgansayer/Neptune-Bomberman` repository.
Its status reader uses REST check-runs for the required `Neptune merge gate`,
pinned to GitHub Actions app 15368 and the exact PR head. A same-name commit
status or a different app cannot satisfy this gate. Missing checks wait; skipped,
neutral, cancelled, failed and unknown terminal outcomes fail. Paginated evidence
is retained; ambiguous duplicate required runs fail instead of choosing a success.

The reader compares the PR's base with current main and checks that main is an
ancestor of the head. Stale bases become revalidation failures. Stacked children
must first be retargeted to protected main and retested. Optional review decisions
do not become a second mandatory Neptune gate. Other repositories retain their
existing CI and independent-review requirements.

Before a Neptune merge request, the coordinator re-reads head/check/base state
and validates the existing settings: native auto-merge, merge commits, retained
branches, strict app-pinned required checks, administrator enforcement, zero
required reviews, and disabled force pushes/deletions. Drift fails; this boundary
never edits settings. It uses `--auto --merge --match-head-commit` without a bypass
or branch deletion. Already-enabled auto-merge is left alone. GitHub protection
remains responsible for rejecting head/base changes at the atomic merge step.

This GitHub adapter is a bounded #77 prerequisite. It does not enable Neptune in
FactoryConfig, skip lifecycle review phases, install an instance, or establish a
live issue-to-merge/restart result. Those remain required before activation.

### Recorded publication experiment

Neptune [PR #516](https://github.com/elgansayer/Neptune-Bomberman/pull/516)
exercised the actual adapter with installed `gh`: a wrong expected head was
rejected without a merge command, then a fresh current-base read accepted the
app-pinned successful gate and issued one native merge request. GitHub merged
head `50ae1d59fc4e1c7259dde76d337f391a73e2e1d1` into base
`ea22ec03b4c83a50a18712b03788d890500327cb`, producing
`c85f8ee75fbca76c552672b6c295220e2a465545`. The source branch remained. A fresh
coordinator process reconciled the merged state without another merge request.
This proves the publication boundary, not an AI implementation job or a running
Neptune service; preserve those separate acceptance gates.
