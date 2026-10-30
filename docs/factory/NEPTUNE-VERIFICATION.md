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

The initial `neptune` profile requires explicit `FACTORY_NEPTUNE_ENABLED=true`.
The checked-in example leaves it false and is not installed or started by this
change. Missing opt-in, wrong repository/base, shared private directories,
untrusted/unlabelled intake policy, additional job concurrency, enabled API
fallback, broker state inside private roots or inherited Elgl prompts all fail
configuration. The profile permits one job and subscription CLI routing only,
with zero variable spending. Reuse the actual operator policy and shared capacity
and health root; an example file is not a new allowance or permission to scale.
Neptune passes that health root explicitly so a config loaded from a mapping
cannot silently use local circuit state or an unrelated process environment.
Host preflight must still establish that this is the existing broker and provider
policy; a directory name or schema check cannot establish account ownership.

Neptune skips mandatory model security/code-review phases. Deterministic quality,
credential protections, applicable verification and protected CI remain required.
The persisted `REVIEWING` state is retained for compatibility but performs a
tests-only handoff. It never publishes an approval status, requests review or adds
`factory-reviewed`. A dirty or changed head returns to verification. Missing or
failed required CI blocks; changed main requires a merge update and revalidation,
even if the legacy non-strict option is disabled. Other profiles keep their
existing independent-review lifecycle. Bootstrap backlog generation and automatic
maintenance analysis are disabled so they cannot become extra provider jobs.

Then stage an instance with separate state/workspaces/GitHub permissions and the
existing shared subscription-provider capacity/health/budget policy. Reconcile
manually running Codex/Gemini sessions, run one bounded issue through merge, test
restart/quota recovery, and only then enable continuity. These verification
changes and synthetic tests do not establish that live acceptance.

Use `automation/neptune-prompts` as the trusted control prompts, outside all worker
diffs. They preserve authoritative Godot, native/browser portability, data-only
packs, reference provenance and bounded fair game bots. The existing doctor reads
Neptune's verifier/gate scripts and instance unit, and validates its actual
tests-only branch protection instead of requiring Elgl review statuses.

The generic systemd unit can host a later Neptune instance, but the existing
installer still provisions only Elgl and Workout. Do not use it as an automatic
Neptune activation path or overwrite the operator's shared agent configuration.
Stage a primary canonical clone with the actual GitHub origin and ignored offline
cache, then run the read-only doctor against accepted installed code. Only an
explicit canary may use `repo-factory task run --issue N`; keep ordinary intake
labelled and bounded. Reconcile existing manual provider sessions first. Enable
the supervised daemon and continuity only after actual job/recovery acceptance.

Tracked scope: Neptune #33/#474, verification #75/#76 and isolation #84. Merge
policy integration remains #77. Provider limits and spend are not increased.

## Preparatory GitHub merge boundary

GitHubClient recognises the exact `elgansayer/Neptune-Bomberman` repository.
Its status reader uses REST check-runs for the required `Neptune merge gate`,
pinned to GitHub Actions app 15368 and the exact PR head. A same-name commit
status or a different app cannot satisfy this gate. Missing checks wait; skipped,
neutral, cancelled, failed and unknown terminal outcomes fail. Paginated evidence
is retained; ambiguous duplicate required runs fail instead of choosing a success.

Installer/recipe changes additionally require `Pinned Godot and Saturn installation`
from that same app and head, following Neptune #518. Applicability uses actual
current-base changed paths, including renamed-from paths, matching the accepted
provisioning workflow's recipe/installer/lock/probe/test paths. Missing, empty,
malformed or potentially truncated file evidence fails. The comparison endpoint's
[documented 300-file cap](https://docs.github.com/en/rest/commits/commits#compare-two-commits)
is rejected; split oversized work instead of silently omitting files. Both
applicable checks must literally succeed before the factory requests auto-merge.
Metadata work does not wait for a workflow that is path-filtered out.

This supplemental requirement is enforced by the publication adapter. The
current classic branch-protection rule still requires the aggregate only; this
change does not claim to configure an additional global GitHub required check or
govern a different actor's independent enqueue path.

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

This GitHub adapter and lifecycle are bounded #77 prerequisites. They do not
install/activate an instance or establish a live issue-to-merge/restart result.
Those observations remain required before unattended continuity.
