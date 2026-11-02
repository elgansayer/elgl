# Supervised bounded Neptune jobs

Tracks Neptune #570 under #536/#33. This is an opt-in integration with the
existing one-issue canary, not another scheduler or a continuity switch.

```sh
repo-factory task run --issue <admitted-issue> --supervised-session --dry-run
repo-factory task run --issue <admitted-issue> --supervised-session
```

Use the existing configured service interface and credentials. The live command
still requires the Neptune tests-only profile, doctor/access/merge readiness,
unprivileged namespaces, trusted ready intake, job ownership, normal WIP/admission
budgets and the current main gate. Dry-run starts no provider or supervisor.
The new option does not grant root, additional allowance, an API fallback or
permission to bypass review/checks in any repository. Default daemon/canary
behaviour remains unchanged.

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

This integration does not enrol existing outside-protocol Codex/Claude/Antigravity
sessions or demonstrate their account-wide count. Keep Neptune continuity off
until #536's live shared-session rollout, configured-account canary, actual
deployment/restart and independent effective counts pass. Model-free process
tests do not establish vendor health, account usage, real research extraction or
Saturn parity. Preserve accepted reference builds, other services and active work.
