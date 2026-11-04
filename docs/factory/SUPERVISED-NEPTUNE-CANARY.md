# Supervised bounded Neptune jobs

Tracks Neptune #570/#536/#33 and public Factory #9812. Neptune daemon and
one-issue canary entrypoints always attach the existing session supervisor.
Pipeline regeneration retains the same private journal and attaches supervision
to the rebuilt router and its existing shared store. This creates no scheduling
loop, account allowance or continuity switch. Other repository defaults are unchanged.

```sh
repo-factory task run --issue <admitted-issue> --supervised-session --dry-run
repo-factory task run --issue <admitted-issue> --supervised-session
```

Use the existing configured service interface and credentials. The live command
still requires the Neptune tests-only profile, doctor/access/merge readiness,
unprivileged namespaces, trusted ready intake, job ownership, normal WIP/admission
budgets and the current main gate. Dry-run starts no provider or supervisor.
The flag remains accepted for compatibility; omitting it cannot disable Neptune
supervision or namespace readiness. Neither form grants root, additional allowance,
an API fallback or permission to bypass review/checks in any repository. The dry-run
path remains a configuration preview and does not instantiate a daemon.

The conservative router retains its normal provider/model eligibility, shared
health, cooldowns, retries, metrics, host resource gate and configured limits.
For supported direct CLI providers it acquires one short renewable reservation
in the same capacity store/key, instead of also acquiring a legacy long lease.
Same-provider retries retain that one slot, but every actual process gets a new
private checkpoint. Unsupported transports fail before model dispatch; they do
not silently receive an unguarded runner.

Execution receives a request-local guarded process runner. Auth/version probes
keep their usual runner, and concurrent requests never mutate a provider's shared
runner. Before the first pulse, the coordinator fsyncs the immutable guardian
boot/PID/start-tick/UID and fenced lease handle under
`<state_dir>/manual-session-identities` (0700 directory, 0600 records). The worker
does not receive the checkpoint, lease token or control channel.

The guardian uses the existing namespace containment and stops after lost
renewal/parent/heartbeat. Lease duration must exceed guardian timeout plus the
ten-second shutdown margin; defaults are thirty and five seconds. A failed or
timed-out guarded attempt retains its slot through the containment drain margin
before cleanup/retry. Cleanup rejects active runners/live guardians and releases
only the owned token. Guardian death alone is not proof of a completed drain.
The trusted namespace init uses the OS Python found through `os.defpath`, because
the coordinator's home/venv is intentionally masked inside the sandbox.

After coordinator death, do not manufacture a new token, renew an expired lease,
adopt a live process, signal a guessed/reused PID or free its slot merely because
a checkpoint loads. Existing immutable records remain available to observers;
the short reservation expires naturally while containment stops the old worker.
The normal canary reconciles durable issue/phase state on its next invocation.
This does not replace the existing host/job lease and recovery policies.

Ordinary tests exercise actual private stores and benign bare guardians inside
the restricted verifier. Mandatory CI also runs real namespace checks: a masked
coordinator Python, private metadata visibility, parent death, retained capacity
and a fresh observer refusing admission/adoption. Missing namespace capability
fails that CI step; it is not skipped or treated as a passing substitute.

The daemon wiring check also exercises ordinary router requests before and after
real pipeline regeneration. A benign local CLI deliberately fails once and then
succeeds. Independent private-store reads see exactly one reservation during each
attempt; retries share that reservation and retain distinct terminal guardian
checkpoints. Broker/journal paths and unrelated credentials are hidden from those
workers. These are namespace and transport/accounting fixtures, with no vendor or
model calls. They do not prove a live issue job recovered after a service restart.

This integration does not enrol existing outside-protocol Codex/Claude/Antigravity
sessions or demonstrate their account-wide count. Keep Neptune continuity off
until #536's live shared-session rollout, configured-account canary, actual
deployment/restart and independent effective counts pass. Model-free process
tests do not establish vendor health, account usage, real research extraction or
Saturn parity. Preserve accepted reference builds, other services and active work.

## Inactive instance preparation

The ordinary verified updater also prepares a missing
`/etc/repo-factory/instances/neptune.env` from an immutable accepted Git blob.
It uses the existing runtime-file materialiser inside a private staging directory,
checks the bounded template with isolated OS Python, and atomically links the
validated file into place. An existing operator file, directory or symlink wins,
including a concurrent creation. Existing configuration is neither read nor
replaced. Invalid, active, funded, secret-bearing or unknown-key templates fail
without publishing the file; temporary staging files are removed.

The preparatory profile remains disabled, uses the existing shared broker/policy,
requires trusted ready intake and green main, and retains one job with zero
variable spend and no reserved review slot. The updater does not enable or start
the Neptune service or its health timer. Root-owned installation stays in the
existing trusted updater; workers receive no privileged installer interface.

An updater already running older code can first adopt the new script and prepare
the profile on its next ordinary timer invocation. A verified historical runtime
without the template defers preparation; a Git read error still fails closed.
Verify actual file identity,
ownership/mode and disabled service/timer state after adoption. A staged profile
does not provide a repository/cache, enrol manual accounts, establish provider
health or pass the real-job/restart gate. Those remain prerequisites of #536/#33
before activation. Preserve shared limits, operator configuration and credentials.
