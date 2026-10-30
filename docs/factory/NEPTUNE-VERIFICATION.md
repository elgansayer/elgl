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
