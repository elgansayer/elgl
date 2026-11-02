# Native tool preparation and verification resumption

A Neptune native verification job can prepare its pinned Godot binary without
sending a missing-cache error to an AI code repair. Preparation runs inside the
existing exclusive host resource lane and preserves the job's state, branch and
provider policy. It returns the exact validated toolchain directory to the same
offline verification command. Metadata-only requirements do not install Godot.

The coordinator snapshots tools and the selected native addon blobs from its
accepted `refs/remotes/origin/main`, rather than executing a candidate installer
or using stale working files. Git archive and extracted source are bounded to
256 MiB. The candidate toolchain lock must be a regular, bounded file without
symlink parents and match that accepted lock. A toolchain change needs a separate
trusted recipe path; this implementation does not authorise new binaries from a
candidate's URL or issue text.

Preparation prefers a valid existing immutable generation. Otherwise it can
copy the healthy legacy Godot binary to a stable hash-named generation, verify
its version and addon identities, and leave the original alias untouched. A
missing binary uses Neptune's existing pinned Godot recipe. Installer inputs,
recipe identity, the actual binary, immutable receipt and live version/addon
probe must agree. Exit zero, a success string, a partial receipt, a backup or an
old operation journal cannot grant readiness. Invalid cache generations remain
preserved by the existing recipe's bounded repair path.

The preparation namespace restores only a private operation directory and the
coordinator's tool cache. Source is read-only. Homes, coordinator state outside
that operation, `/run`, container sockets and sibling repositories are masked;
the recipe receives no provider or Git credentials. The networked preparation
step can use configured proxy/TLS routing. A resolver file pointing into `/run`
is restored read-only by itself. The verification and independent probe retain
their own offline network namespaces. Recipe workers lose capabilities and
cannot inherit the guardian's control or lifetime descriptors.

The existing guardian and trusted namespace PID1 stop descendants on timeout,
owner death, guardian death or lost supervision. The coordinator fsyncs the
guardian's boot/PID/start-tick/UID identity before its first dispatch pulse.
Operation journals under `<state_dir>/tool-preparation` preserve state and
diagnostics across restart; they contain no provider lease or authority to adopt
a process. Each retry revalidates the actual generation and reruns its smoke.
The existing host lane, cache lock and recipe lock prevent duplicate live builds.
Accepted Git source snapshots are reconstructible and discarded after drainage;
unique logs, journals, failed generations and prepared binaries remain.

The existing disk reserve is checked before snapshot/copy/install. Recipe
commands have bounded time, captured output and per-file resource limits. A
preparation failure stays in verification and follows the durable infrastructure
backoff, without model repair, provider-health reset or another account allowance.
This does not add a scheduler or enable Neptune continuity.

This first lifecycle covers pinned Godot/native verification. It does not claim
to provision every baseline executable, browser export template or research
capability. Those integrations remain Neptune518, alongside deployed real-job
and restart acceptance. Original Saturn media never enters preparation. Version
and addon identity smoke is not emulator boot, native gameplay or Saturn parity.

`tests/test_neptune_preparation.py` uses owned Git repositories and processes
with explicitly synthetic tool artefacts for install/reuse/corruption/refusal
and fresh-process recovery. Dispatcher tests preserve the same job and decline
AI repair on tool failure. The mandatory
`runtime_checks/test_preparation_namespace.py` additionally checks real source,
credential/FD/network isolation, resolver access, timeouts and kernel pidfd exit
observations after owner/guardian SIGKILL. Missing namespace capability fails;
there is no skip or substitute success.

Neptune647 tracks this slice under518/33/514. A candidate-host experiment actually
installed the accepted Godot4.7.2 binary from a fresh cache and reused the same
receipt. That evidence is separate from normal review, installed adoption and a
later provider-driven job. See the issue's exact-head CI and private receipts
before claiming deployment.
