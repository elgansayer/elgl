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

## Validation and deployment boundary

`tests/test_process_guardian.py` uses real synthetic OS processes and private
capacity state, with no vendor calls or credentials. It covers input/output,
normal exit, lease refusal/loss, checkpoint failure, request timeout, coordinator
SIGKILL/SIGSTOP and guardian SIGKILL/SIGSTOP. The actual isolated cases run
descendants that attempt to kill PID 1, clear parent-death signals and escape
process groups, then inject coordinator/guardian faults.

Run `FACTORY_REQUIRE_GUARD_NAMESPACE_TESTS=1 python -m pytest
tests/test_process_guardian.py` from `automation/` on the target host. That flag
turns missing namespace support into failure. Unsupported CI hosts explicitly
skip only the namespace cases; ordinary real-process tests still run. These are
factory tooling tests, not game, emulator or continuous-service health checks.

Neptune [538](https://github.com/elgansayer/Neptune-Bomberman/issues/538) tracks this
primitive. Parent [536](https://github.com/elgansayer/Neptune-Bomberman/issues/536)
still requires the manual launcher, provider-policy integration, recoverable
session identities, live accounting and a deployment/restart acceptance test.
