# Accepted Neptune research verification

Tracks Neptune #657 / #510 / #76. This is an opt-in extension of the existing
job, preparation, resource gate and offline verifier. It starts no scheduler,
provider session or service and does not enable Neptune continuity.

`FACTORY_NEPTUNE_INTAKE_DIR=/private/coordinator/accepted-neptune` selects a
coordinator-owned mode0700 registry outside source/worktrees. Only a claimed
`github-issue` with a positive numeric identifier is supported. External PRs
without an accepted issue binding fail closed when this option is enabled.
The legacy unbound preflight remains available when the option is absent; that
preflight is generic testing, not research/feature acceptance.

For issue657 the registry contains:

```text
657/intake.json
657/artifacts/behaviour-trace-exact-v1/reference.json
657/artifacts/behaviour-trace-exact-v1/candidate.json
```

Use the existing `neptune.factory-intake.v1` schema and fields. No new research
schema, shell command or arbitrary verifier is accepted from issue prose.
`task.revision` is SHA256 of canonical sorted compact JSON containing exactly
`repository`, numeric `issue`, `title` and `body` from the claimed Task.
`task.evidence` must include exactly one `candidate-head:<40-hex-SHA>` matching
the persisted local candidate commit. The existing named check and five
`trace-v1:` identities select supplied observations as documented by Neptune.
The accepted base must match the coordinator's fetched `origin/main`.

The dispatcher commits local candidate changes before verification and fsyncs
`verification_candidate_sha` in the existing JobStore. This is unverified work:
`latest_verified_sha`, remote publication and task verification remain unset.
Missing/stale intake is infrastructure backoff in the same job without an AI
quality repair. The coordinator can capture/attest output after this checkpoint,
then resume the existing job with the appropriate fresh accepted snapshot.
Capture production and authentic-reference acquisition are separate capabilities;
this adapter does not fabricate observations or sign capture receipts.

Reference identities, rules, issue revision and bounded scope are locked in
`neptune_contract_sha` across restart/repairs. A repaired candidate can receive
new coordinator-attested candidate-head/source/file identities without changing
that target. Changing reference/rules needs a distinct authorised task contract;
it cannot silently turn a failing comparison into a passing one.

Inside the existing exclusive host lane the coordinator stages accepted-main
`tools` using the existing snapshotter and copies only the selected intake and
two bounded regular trace files. Registry and issue directories must be private;
symlinks/hardlinks, duplicate JSON, missing/oversized inputs and hash mismatches
fail. The original registry, signing authority and other private state are never
mounted into verification. Accepted readiness/selection runs through the existing
guarded offline preparation namespace, with guardian identity checkpointed.

The verifier receives the staged bundle through an additional read-only mount.
Python `-I` loads the accepted-main parser/comparer from that bundle rather than
candidate-controlled modules. The candidate is still the source under test.
Receipts must match the expected issue/revision/base/head/paths and every named
feature's exact selected identities and successful comparison, as well as the
complete current generic check list (including `film-contracts`). Candidate,
original intake and original artifact identities are rechecked before success.
Signing authority, host credentials, provider health and budgets are unchanged.

Private journals remain under `state/research-verification/<attempt>/journal.json`;
staged source/input copies are removed after the attempt. Original coordinator
inputs and candidate commits survive. Interrupted staging is not a success receipt
and can be regenerated in a fresh attempt. The existing publication path reuses
the tested checkpoint rather than creating an empty or untested commit afterward.

Unit fixtures test real Git commits/JobStore recovery and failure classification.
Mandatory public CI namespace checks use explicitly labelled owned protocol
fixtures, matching/divergent synthetic traces, read-only inputs and hidden
credentials/authority. They do not establish compatibility with private Neptune
algorithms. Elgl's repository-scoped token cannot fetch private Neptune; no
cross-repository secret or private source is added to the public repository.

Private completion evidence must additionally run the same namespace test with
`NEPTUNE_ACCEPTED_SOURCE` pointing to a clean accepted Neptune checkout at
`8e94003417435ef396192dbf25ee6882fc3567a2`. This invokes the actual parser/comparer,
whose source identities are checked against the pin. Keep this PR draft until
that experiment passes. Private logs stay private; publish only result identities.
The small metadata fixture replaces only its unused native-addon lock with a
labelled non-native marker. These checks prove wiring, not authentic Saturn
captures, production Godot parity, effective account-wide admission or continuous
restart recovery. Those remain operational acceptance under #518/#536/#510/#76.
