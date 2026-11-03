# Opt-in provider process supervision

`AgentProcessRunner(guard_timeout_seconds=..., heartbeat_check=..., on_start=...)`
adds a Linux process guardian to the existing runner. Existing callers retain
their current behaviour. This primitive neither launches a manual CLI nor enrols
existing sessions, changes account limits or enables Neptune continuity.

The optional `heartbeat_check()` authorises before any process starts and before
each control pulse. A caller can renew its owned renewable capacity handle here.
The optional `on_start(guardian_pid)` runs before the first pulse, allowing a
future launcher to checkpoint identity before dispatch. Failure there prevents
provider execution. A PID alone is not sufficient recovery identity: that future
launcher must persist and verify process start identity and its lease token.

## Containment and failure behaviour

The coordinator starts a separate, non-dumpable guardian with a parent-death
signal and a private control socket. It requires successful pulses, acknowledges
them, and will not start the worker before the first pulse. The existing private
PID/mount namespaces and capability drop remain in place. In guarded isolation,
a trusted Python init runs as PID 1 and starts the provider as its child. Only
that init inherits a read end of the guardian's lifetime pipe. The provider
inherits neither lifetime nor control descriptors.

Coordinator death kills the guardian. A stopped coordinator or lost lease stops
its pulses; the guardian closes the lifetime writer and drains its worker. A
killed guardian closes the writer independently. The trusted init exits when the
pipe closes; the kernel then kills all descendants of its PID namespace, even
those that created a new session or cleared their own parent-death signal. The
coordinator also checks acknowledgements and kills a stopped guardian. Deliberate
stopping of both the coordinator and guardian simultaneously is outside this
primitive's fault model and needs the future external service supervisor.

Guard failure returns cancellation and a nonzero result, including when a worker
handles termination by returning zero. A normal nonzero provider exit preserves
its status/output. Request timeouts retain the existing timeout classification.
The existing cancellation classifier does not reinterpret supervision loss as
provider outage or authorise provider failover. `isolate_processes=False` exists
for trusted fixtures; it does not provide namespace descendant containment.

Guard intervals must be finite, positive and at most 30 seconds. Pulses occur at
most one second apart (or one quarter of a shorter interval). The launcher must
choose a lease interval larger than its guard deadline plus startup, scheduling
and drain margins. A 60-second lease with a 10-second guard is a candidate, not
an implemented manual-session policy. Lease expiry alone never proves that a
process stopped. Only release an owned token after confirmed process drainage.

Linux references: [parent-death signals](https://man7.org/linux/man-pages/man2/pr_set_pdeathsig.2const.html),
[PID namespace init semantics](https://man7.org/linux/man-pages/man7/pid_namespaces.7.html)
and [unshare process handling](https://man7.org/linux/man-pages/man1/unshare.1.html).

## Bounded CLI process observations

The direct CLI runner emits `factory.provider.process_observation` at most once
per 30 seconds during its wait and one final observation after its existing
cleanup waits. It records the owned process PID, monotonic elapsed seconds,
configured process timeout and output capture cap, observed stdout/stderr byte
counts, captured bytes, truncation and age of last pipe output. An absent output
age is `None`, not evidence of a stall. The final flag marks this runner's last
observation; it does not independently prove descendant drainage or model success.

Pipe readers collect available bytes immediately, including short flushed writes.
Observed counts continue after the existing capture cap is reached; retained
output remains bounded by that cap. These logs contain no command, prompt,
environment, working directory or output content. They are fixed-schema local
diagnostics, not an output transcript or another durable session store.

Silence and byte activity do not identify model turns, remote work, correctness,
vendor availability or account usage. Neither causes cancellation, retry,
provider rotation or another model call. Existing deadlines, guardian pulses,
terminal classification, turn policy and output limits still decide execution.
Log-sink errors cannot replace a child's actual result. The unguarded timeout
still starts after `on_start`; the guarded absolute deadline remains unchanged.

`tests/test_process_observations.py` uses real owned local children to exercise
short writes before exit, both output streams, retained output caps, increasing
idle age, normal/failing exits and timeouts with and without the guardian. It
also checks cadence, content omission and a broken observation sink. These are
tooling tests with no inference. Normal service adoption and a later real
provider-job observation remain separate deployment evidence.

## Validation and deployment boundary

`tests/test_process_guardian.py` uses real synthetic OS processes and private
capacity state, with no vendor calls or credentials. It covers input/output,
normal exit (including provider status 125), lease refusal/loss, checkpoint
failure, request timeout, coordinator SIGKILL/SIGSTOP and guardian
SIGKILL/SIGSTOP. These ordinary tests run inside the restricted Factory verifier.

`runtime_checks/test_process_guard_namespace.py` is a separate mandatory host
integration suite. It runs descendants that attempt to kill PID 1, clear
parent-death signals and escape process groups, then injects coordinator/guardian
faults. Run `python -m pytest runtime_checks/test_process_guard_namespace.py`
from `automation/` on the target host. Missing namespace support fails this
command; it never substitutes a passing assertion for unavailable containment.
The default `tests/` collection is not evidence that host integration ran.

The required CI `factory` job runs both suites. Its trusted setup enables
unprivileged user namespaces on the disposable Ubuntu runner where
[AppArmor restricts them](https://documentation.ubuntu.com/release-notes/24.04/);
this changes neither the VPS nor provider-worker privileges.
The explicit integration step must succeed for `CI / required` to pass. The
Factory's nested, capability-restricted verifier runs the ordinary suite and
relies on that exact-head CI result for host integration. These are factory
tooling tests, not game, emulator or continuous-service health checks.

Neptune [538](https://github.com/elgansayer/Neptune-Bomberman/issues/538) tracks this
primitive. Parent [536](https://github.com/elgansayer/Neptune-Bomberman/issues/536)
still requires the manual launcher, provider-policy integration, recoverable
session identities, live accounting and a deployment/restart acceptance test.
