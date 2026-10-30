# Immutable manual-session recovery evidence

`SessionIdentityJournal` is a private, write-once checkpoint primitive for the
future supervised manual-session launcher. It does not launch, signal, adopt or
renew anything, and it does not enable Neptune continuity.

`ProcessIdentity.capture(pid)` records the Linux boot UUID, PID, effective UID and
process start ticks. It rejects zombies and unstable captures. The effective UID
comes from `status`, since procfs file ownership can change for non-dumpable
processes. Parsing `stat` handles spaces and closing parentheses in process names.
`matches_live()` is a read-only, point-in-time comparison. A successful comparison
is not authority to signal or adopt that PID: the future launcher still needs
race-safe process handles, verified ancestry and broker ownership.

Linux references: [process start ticks](https://man7.org/linux/man-pages/man5/proc_pid_stat.5.html),
[effective UID](https://man7.org/linux/man-pages/man5/proc_pid_status.5.html) and
[non-dumpable procfs ownership](https://man7.org/linux/man-pages/man5/proc_pid.5.html).

`SessionCheckpoint` binds that identity to a canonical session UUID and the
already-acquired `RenewableCapacityLease` handle. It carries no command, prompt,
environment or provider credential. The lease token is private coordination state
and remains inside an operator-owned directory.

The journal requires an owned private directory and uses directory descriptors,
no-follow opens and exclusive creation. It writes mode 0600, fsyncs the complete
record and directory before returning, and refuses an existing filename. A caller
must persist this checkpoint successfully before sending the first guardian pulse.
Concurrent creators cannot replace each other's evidence. A crash during writing
can leave an incomplete record; recovery rejects it and never substitutes an older
backup. This is deliberate fail-closed evidence, not a general mutable job store.

Loading requires a bounded private regular file, rejects symlinks/hardlinks,
invalid schema/version and filename/identity mismatches, and does not block on a
FIFO. A historical checkpoint remains readable after the process exits, while
`matches_live()` returns false. Loading does not access, refresh, acquire or release
the broker reservation. The live token must be checked separately before any
recovery action; stale evidence grants no permission to reacquire a slot.

`tests/test_session_identity.py` uses owned synthetic subprocesses and private
broker/filesystem state. It checks fresh-interpreter recovery without broker
mutation, stale start/boot/UID refusal, non-dumpable processes, zombie detection,
corruption, unsafe paths/permissions and concurrent creation. These are tooling
tests, with zero vendor requests. They do not establish account-wide manual-session
enrolment, restart adoption or production health.

Neptune [539](https://github.com/elgansayer/Neptune-Bomberman/issues/539) tracks this
primitive; parent [536](https://github.com/elgansayer/Neptune-Bomberman/issues/536)
retains launcher, policy, actual shared accounting and deployment/restart work.
The independent process guard is tracked in
[538](https://github.com/elgansayer/Neptune-Bomberman/issues/538).
