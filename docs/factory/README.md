# HelloTalk OpenHands Factory runbook

The Factory is the sole autonomous engineering control plane for this repository. It discovers GitHub work,
schedules durable jobs, creates isolated worktrees, routes each AI-backed phase to an eligible provider, verifies
the result, obtains an independent review, repairs failures, and permits merge only for the reviewed head SHA.

The daemon is deployed from `origin/main`. Task agents still work on isolated task branches and pull requests and
never write application changes directly to `main`.

## Production readiness

Code on `main` is not proof that the production daemon is healthy. A rollout is complete only when the Factory
host proves all of the following:

- the dedicated checkout is clean and fast-forwarded to `origin/main`;
- `hellotalk-factory.service` and `hellotalk-factory-health.timer` are active;
- every enabled subscription CLI is installed and authenticated as the daemon's operating-system user (`dev`);
- trusted intake is enabled for this public repository, with every automatic actor explicitly listed;
- `hellotalk-factory providers check` reports at least one usable provider before an activation canary;
- `hellotalk-factory doctor --online` passes;
- root and Factory-state volumes both retain the configured free-space reserve;
- one baseline GitHub ruleset requires pull requests and `CI / required` on `main`;
- `factory/independent-review` is required by either that ruleset or a review-only ruleset whose sole optional
  bypass is the exact repository-owner user in pull-request mode;
- the baseline ruleset may use the same exact-owner, pull-request-only bypass, while role, team, app, deploy-key,
  direct-push, and always-mode bypasses remain prohibited;
- the required statuses are pinned to their expected GitHub App sources before any additional write actor is
  trusted;
- `hellotalk-factory legacy scan` reports no active competing executor;
- non-paid diagnostics prove configuration, fallback, circuit, structured-output, and stale-SHA behaviour;
- one deliberately small issue completes issue, implementation, review, CI, merge, and closure end to end.

The daemon runs as the operator's own login user (`dev`) and systemd sets `HOME=/home/dev`, so it reuses that
account's already-authenticated CLI sessions directly. There is no separate service-account home to keep in sync.

Temporary exhaustion of every provider does not stop an already configured daemon. `providers check` reports
`agent-usable` as a warning, the durable queue remains online, and jobs wait for the earliest provider recovery.
An initial production activation still needs one usable provider because the required end-to-end canary cannot
otherwise run.

The 2026-08-17 audit began with a failed host, stale service, and unenforced Factory statuses. The repaired daemon
is now running a partial production canary, but no complete implementation-to-merge cycle has passed yet. Treat
[AUDIT-2026-08-17.md](AUDIT-2026-08-17.md) as the current evidence ledger. A green repository revision is not an
operational canary.

## Architecture

```text
GitHub issues and external PRs
              |
              v
      Factory daemon and scheduler
              |
              v
      durable FactoryPipeline state
              |
              v
          AgentRouter
       /      |      |       |          \
 Claude   Codex   Google  OpenCode  OpenHands SDK
       \      |      |       |          /
              v
       isolated task worktree
              |
       security and verification
              |
       independent structured review
              |
        PR checks and CI repair
              |
     SHA-bound merge eligibility
```

Direct subscription providers run non-interactively as the dedicated service user inside private user, mount,
PID, and proc namespaces. They receive a small environment with API keys, GitHub tokens, Telegram tokens, and
unrelated daemon settings removed. The sandbox restores only the current worktree, the read-only canonical
repository, provider-specific credential paths, and read-only executable paths after hiding every other provider
session, Factory state, logs, runtime sockets, and host temporary files. OpenHands is a provider adapter using the
existing SDK runner. Its terminal remains inside the rootless, networkless Podman worker and its file editor
remains confined to the task worktree. Its child configuration omits GitHub, Telegram, and legacy Gemini
credentials which are unrelated to model execution.
The direct-provider namespace also remounts the installed Factory tree read-only and gives `/tmp`, `/var/tmp`, and
`/dev/shm` private filesystems, so an agent cannot rewrite the deployed runtime or communicate through shared
temporary files.

A direct provider must read its own subscription session and contact its vendor. Namespace isolation therefore
does not make arbitrary public issue text safe. Production intake admits configured GitHub actors automatically
and requires a maintainer-controlled `factory-ready` label for everyone else. A vendor-domain egress proxy or
credential broker is still recommended for defence in depth.

Provider installation, authentication, and model probes run in disposable empty directories. A nominal health
check never receives the writable canonical checkout as its working directory.

Repository-controlled verification runs in a separate no-network namespace with a fresh home and temporary
directory. It can write the task worktree and read the canonical dependency tree, but cannot read provider
sessions, durable Factory state, logs, rootless Podman sockets, shared host temporary files, or sibling process
environments. The deployed Factory tree is read-only there too.

See [ACTIVE_ARCHITECTURE.md](ACTIVE_ARCHITECTURE.md), [AGENT-ROUTING.md](AGENT-ROUTING.md),
[SUBSCRIPTION-AGENTS.md](SUBSCRIPTION-AGENTS.md), [MANUAL-MERGE.md](MANUAL-MERGE.md),
[CONTROL-PANEL.md](CONTROL-PANEL.md), and [HOST-STORAGE.md](HOST-STORAGE.md) for the detailed contract.

## Durable lifecycle

```text
DISCOVERED -> IMPLEMENTING -> SECURITY_REVIEW -> VERIFYING
  -> QUALITY_REPAIRING when needed
  -> PR_DRAFT -> REVIEWING -> CI_PENDING
  -> REPAIRING when needed -> REVIEWING
  -> MERGE_QUEUED -> MERGED -> DONE
```

External pull requests enter through discovery and local verification before `REVIEWING`. A changed PR head
immediately loses `factory-reviewed` and `factory-review`; the old worktree is safely retired or archived, then
the current remote head is verified and reviewed again. Reopened external PRs return to `DISCOVERED`.

If no PR review is already active, the scheduler submits the highest-priority runnable external pull request
before issue work, including when only one worker is available. It also withholds one provider slot from new issue
jobs until that review worker finishes. Pull requests default to priority 5, while trusted `guardian-alert`,
`priority:critical`, and `priority:high` labels promote urgent reviews. Ties use the oldest numeric identifier.
Other slots remain ordered by issue priority and identifier. This bounded lane prevents required independent
reviews from starving behind a large critical-issue backlog.

Provider exhaustion does not consume a task attempt. The job remains in its current state with `next_attempt_at`
set from provider cooldown or capacity. Repository, test, task, and policy failures do not trigger blind provider
rotation. Persisted failure classes and deterministic jittered backoff remain authoritative across restart.

### New-issue admission cadence

Production admits one newly discovered GitHub issue per hour through:

```text
FACTORY_NEW_ISSUE_INTERVAL_SECONDS=3600
FACTORY_NEW_ISSUES_PER_INTERVAL=1
```

This is a durable admission gate, not the daemon polling interval. The admission record survives daemon restarts
and prevents startup bursts. It applies only while an issue is in `DISCOVERED`; implementation, security review,
verification, quality repair, PR creation, independent review, CI repair, merge polling, and incoming pull-request
review continue whenever worker capacity is available. Setting the interval to `0` restores unlimited historical
admission behaviour. Do not use `FACTORY_COOLDOWN_SECONDS=3600` for this purpose: that value controls source and
health refresh cadence and would not reliably enforce one newly admitted issue per hour.

All `jobs.json` read-modify-write operations use a cross-process lock, so daemon, doctor, watchdog, and operator
commands cannot overwrite sibling transitions. Provider provenance is retained as the latest 500 attempts per
job, preventing one difficult task from growing durable state without bound.

Durable execution states abandoned by a dead worker are recovered through the same timeout retry policy. Live
futures and polling-only `CI_PENDING` or `MERGE_QUEUED` jobs are never treated as abandoned work.

## Safety gates

Before a task branch can merge, the Factory preserves these controls:

- isolated worktree rooted beneath `FACTORY_WORKTREE_DIR`;
- fresh `origin/main` base for issue work;
- trusted host-owned Git add, commit, push, PR, status, and merge operations;
- rejection of protected-base pushes inside `GitWorkflow`;
- local validation of every persisted external pull-request branch before fetch or push;
- repository-native verification selected by `verification.py`;
- networkless verification namespaces with provider homes, durable state, logs, runtime sockets, and sibling
  processes hidden;
- deterministic quality checks for placeholders, unsafe type escapes, skipped tests, and production mocks;
- deterministic pre-push rejection of provider credential artefacts, high-confidence tokens, and private keys;
- stale report deletion before every structured-output attempt;
- file-based report validation before provider success;
- independent review by a different provider where possible;
- one merge-queue lane submitted before issue work, with one provider slot withheld from new issue jobs while the
  selected pull-request worker is active;
- SHA-scoped `factory/independent-review` status, reset to `PENDING` before every PR-backed AI phase, refresh, or
  base update;
- head-SHA comparison before the scheduled merge queue;
- atomic base updates and renewed verification/review when a head is behind `main`;
- atomic `--match-head-commit` enforcement at the merge call;
- literal success for `CI / required` and `factory/independent-review` in every autonomous merge;
- a baseline ruleset requiring pull requests and strict `CI / required`;
- an optional exact-owner, pull-request-only bypass on the baseline and review-only rulesets;
- a review-only ruleset requiring `factory/independent-review`;
- human `CHANGES_REQUESTED` review blocking;
- no administrator bypass by the Factory or repository workflows.

The repository owner can deliberately waive CI, independent review, or both through an existing pull request.
See [MANUAL-MERGE.md](MANUAL-MERGE.md). Factory automation still requires both statuses and never invokes that
manual authority. Roles, teams, apps, deploy keys, direct pushes, and always-mode bypasses remain prohibited.

The structured report files are control artefacts. They are validated, deleted, and never committed as task
code. Every code-mutating review or repair returns to verification and a fresh independent review.

## Bootstrap and deployment

Keep at least 5 GiB free for worktrees, dependency caches, and build output.

```bash
REPOSITORY_ROOT="$(git rev-parse --show-toplevel)"
sudo install -d -m 0750 -o root -g root /etc/hellotalk-factory
sudo install -m 0600 -o root -g root \
  "$REPOSITORY_ROOT/config/systemd/factory.env.example" \
  /etc/hellotalk-factory/factory.env
sudoedit /etc/hellotalk-factory/factory.env
sudo "$REPOSITORY_ROOT/setup-debian.sh"
sudoedit /etc/hellotalk-factory/agents.json
sudo chmod 0600 /etc/hellotalk-factory/factory.env
sudo chown root:root /etc/hellotalk-factory/factory.env
sudo chmod 0640 /etc/hellotalk-factory/agents.json
sudo chown root:hellotalk-factory /etc/hellotalk-factory/agents.json
```

Set `GITHUB_TOKEN` before bootstrap. On a first install only, bootstrap can import the narrow Factory allowlist
from a readable repository `.env`, but the explicit root-only file above is preferred. The service user must not
run `gh auth login`: setup resets inherited Git credential helpers and every clone, fetch, push, and GitHub CLI
operation receives the root-managed token only for that Factory-owned child process. Doctor fails if it finds a
GitHub CLI OAuth token or persistent Git credential in the agent-readable service home.

The production starting policy is
[`config/factory/agents.production.json`](../../config/factory/agents.production.json). It enables Claude Code,
Codex CLI, and OpenCode, leaves Google disabled until service-user authentication is proven, and keeps OpenHands
emergency-only. Providers are optional independently. Do not enable a provider merely because its binary exists.

Deploy only from `main`:

```bash
git switch main
git pull --ff-only origin main
sudo scripts/deploy-and-start-factory.sh --use-existing-credentials
```

The deploy script rejects a non-main ref, fast-forwards the dedicated checkout, disables the retired meta-agent,
refreshes the frozen Python environment and Node dependency trees, installs Cypress, rebuilds the secretless
worker image, verifies systemd, starts the daemon, and runs online diagnostics. It updates
`agents.example.json` but creates `agents.json` only when the operator file is absent. Existing routing and
credentials are not replaced or printed. It records whether the daemon and watchdog were active before the
maintenance window. If dependency installation, image construction, or a later deployment step fails, the exit
trap restores those previously active units so a failed upgrade does not silently leave the Factory down.
The Python refresh preserves the pinned `uv` bootstrap tool as an intentional extraneous package. If an older
exact sync removed it, deployment restores the pinned version before continuing and proves it remains executable
after the refresh. This keeps both startup doctor and isolated repository verification recoverable.

For repeated deployments whose package manifests and worker inputs have not changed, use the verified fast path:

```bash
sudo scripts/deploy-and-start-factory.sh --use-existing-credentials --fast
```

Both modes run the startup doctor with the same `HOME` and `PATH` as the systemd service. This is required for
subscription CLIs installed beneath the operator account and for the deployed `uv` executable. A bare
`sudo -u dev ... doctor` can inherit sudo's restricted path and falsely report that authenticated providers are
not installed.

Fast deployment still fetches and fast-forwards `main`, repairs canonical host configuration, refreshes the frozen
Python environment, installs current systemd files, runs startup preflight, and verifies the live daemon. It skips
a Node dependency tree only when the package manifests, lockfile, Node/npm toolchain, and npm hidden lock all match
a deployment-owned fingerprint. Installed package manifests and executable links are also included, so a
partially removed dependency tree is a cache miss. It skips the worker build only when all tracked `automation/`
inputs and the rootless Podman image ID match. Cache misses automatically run the normal phase. The first fast
deployment after installing this feature has no trusted fingerprints, so it performs a full refresh and warms
the cache.

Deployments are serialised with `/run/lock/hellotalk-factory-deploy.lock`. Maintenance stops and drains both the
watchdog timer and any active watchdog invocation before stopping the daemon, preventing a watchdog restart from
overlapping dependency or image replacement.

Because deployment deliberately preserves the operator policy, compare it with the newly deployed model and
adapter example after every upgrade, then merge reviewed changes explicitly:

```bash
sudo diff -u /etc/hellotalk-factory/agents.json /etc/hellotalk-factory/agents.example.json
```

The production environment sets `FACTORY_REQUIRE_TRUSTED_INTAKE=true`. Issues and same-repository pull requests
from `FACTORY_TRUSTED_GITHUB_ACTORS` remain fully automatic. Work from any other actor requires the
maintainer-controlled `factory-ready` label. `needs-human`, `factory-skip`, and `duplicate` still exclude an
issue. Set `FACTORY_REQUIRE_READY_LABEL=true` only when every issue, including trusted-owner work, needs manual
queue admission. The production example trusts `elgansayer` and `app/github-actions`; review that list whenever
workflow ownership changes.

## Subscription authentication

The daemon runs as the operator's own login user (`dev`), so it reuses that account's normal, already-authenticated
CLI sessions directly instead of maintaining a separate service-account credential set. Use this environment for
every check:

```bash
FACTORY_HOME=/home/dev
FACTORY_PATH="$FACTORY_HOME/.local/bin:$FACTORY_HOME/.opencode/bin:$FACTORY_HOME/.npm-global/bin:/opt/hellotalk-factory/venv/bin:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" claude auth status
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" codex login status
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" opencode auth list
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" agy models
```

Authenticate each CLI normally as `dev` - the same login you'd use interactively. Do not place provider tokens in
`factory.env` when the adapter is configured for subscription auth. Common API-key variables are stripped from
direct subscription-provider environments so they cannot silently switch to PAYG authentication.

In particular, do not put `OPENCODE_GO_API_KEY` in the repository `.env`. Use `opencode auth login --provider
opencode-go` as `dev`. `auth list` and `models opencode-go` do not prove remaining balance, so classify an
`insufficient balance` canary as quota exhaustion rather than repeating login. Disable the OpenHands operator
provider when no separate SDK credential exists.

Google Antigravity remains disabled until `agy models`, doctor, and one harmless headless service-user canary all
pass. Gemini CLI remains configurable only for account types where Google still supports that path. Provider
installation and authentication details are in [SUBSCRIPTION-AGENTS.md](SUBSCRIPTION-AGENTS.md).

## Diagnostics

```bash
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory status
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory metrics
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory dashboard show
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory dashboard sync --force
sudo systemctl status hellotalk-factory.service hellotalk-factory-health.timer
sudo journalctl -u hellotalk-factory.service -n 200 --no-pager
sudo scripts/maintain-factory-host-storage.sh
```

- `providers check` is the bounded, read-only systemd preflight. It reports enabled state, executable and
  authentication health, transport, selected model, current-generation concurrency, cooldown, aggregate provider
  usability, competing executors, authenticated repository access, and the layered GitHub merge policy. An
  optional OpenHands SDK OpenAI OAuth failure is a warning when another configured provider is usable. That OAuth
  profile is separate from Codex CLI's ChatGPT subscription login. Detached unrestricted provider processes
  remain fail-closed competing executors. A provider attached to an operator TTY is treated as an interactive
  session rather than a second autonomous control plane.
- `doctor --online` checks architecture ownership, state, root and Factory-volume disk reserves, daemon heartbeat,
  rootless worker isolation,
  provider and verification namespaces, providers, absence of persistent service-home GitHub credentials, the
  scoped Git credential helper, authenticated GitHub repository reads, and the layered server-side merge policy.
- `status` prints the durable daemon generation, queue counts, active jobs, and heartbeat.
- After a watchdog restart, the default 30-second grace window lets systemd preflight complete and the daemon
  publish its initial heartbeat before recovery is judged. Set `FACTORY_WATCHDOG_RESTART_GRACE_SECONDS` only when
  host startup measurements justify a different value.
- GitHub and worktree reconciliation runs on a single control worker. The owner loop publishes heartbeat updates
  every ten seconds while that pass is busy, and closed jobs are merged in one durable batch without overwriting
  concurrent worker transitions.
- Isolated verification takes its tool path from the running Factory virtual environment's `sys.prefix`. This
  keeps the pinned `uv` executable available after privilege reduction without exposing host or provider paths.
- `metrics` prints provider, model, phase, and typed failure outcomes without transcripts or credentials.
- `dashboard show` renders the sanitised GitHub control-panel body without network access.
- `dashboard sync` creates or refreshes one `factory-status` and `factory-skip` issue, then accepts only exact
  pause, resume, status, or restart comments from the separate `FACTORY_CONTROL_GITHUB_ACTORS` allowlist.
- the dashboard storage rows distinguish root capacity from the secondary-backed Factory state volume and expose
  a short-term exhaustion estimate only after a meaningful decline.
- `reconcile` releases expired task leases and never deletes worktrees or branches.
- `pause` stops new scheduling while preserving jobs, branches, active workers, and pull requests.
- `resume` re-enables scheduling after the underlying cause is resolved.

Some CLIs expose only local authentication metadata. Exact quota is therefore best-effort until a real attempt
returns a rate, quota, or retry signal. Never invent a remaining quota value.

The no-generation adapter contract was checked on 2026-08-17 with Claude Code 2.1.233, Codex CLI 0.147.0,
Antigravity 1.1.13, and OpenCode 1.18.15. These are evidence for the tested contract, not permanent version pins.
Repeat harmless version, auth, and model probes after every CLI upgrade.

## Rootless Podman checks

The Factory service delegates only its own cgroup beneath the systemd resource cap. A healthy installation needs
a real systemd user session for `dev`:

```bash
sudo loginctl enable-linger dev
id -u dev
```

`XDG_RUNTIME_DIR` in the unit must match `/run/user/<uid>`. If nested cgroup controller flags are unavailable,
the diagnostic worker retries without per-container CPU, memory, and PID flags while preserving no-network,
user-namespace, dropped-capability, and worktree confinement. Actual agent terminals continue to use `keep-id`
isolation. A host-namespace fallback is permitted only for the read-only smoke diagnostic when `newuidmap` is
blocked.

## Operator recovery

Run recovery commands as the operator user with the same environment used by systemd. Defining this helper in the
current root shell prevents sudo's secure path from hiding authenticated provider executables:

```bash
FACTORY_HOME=/home/dev
FACTORY_PATH="$FACTORY_HOME/.local/bin:$FACTORY_HOME/.opencode/bin:$FACTORY_HOME/.npm-global/bin:/opt/hellotalk-factory/venv/bin:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"
factory_cli() {
  sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" \
    /opt/hellotalk-factory/venv/bin/hellotalk-factory "$@"
}
factory_cli doctor --online
factory_cli providers check
factory_cli status
factory_cli metrics
factory_cli dashboard sync --force
factory_cli reconcile
factory_cli pause
factory_cli resume
factory_cli backlog requeue-quarantined
factory_cli backlog requeue-quarantined --issue 1234
factory_cli backlog requeue-quarantined --issue 1234 --announce
```

If every provider is unavailable, do not delete the job, circuit, lease, or `jobs.json`. Fix service-user auth or
wait for the earliest cooldown, confirm health, then resume. The daemon remains online and can continue work that
has another eligible provider. If a recovery worktree is dirty or damaged, Factory archives it beneath
`/var/lib/hellotalk-factory/recovery` before removing its Git registration.

Do not hand-edit a far-future retry or lease timestamp to pause work. Provider, task, and retry deadlines are
schema checked and duration bounded so malformed state recovers instead of wedging the queue. Use `pause` for an
operator hold.

Provider-side exhaustion remains automatic: it does not increment task attempts or trigger quarantine. When the
same task-side failure reaches `FACTORY_MAX_CONSECUTIVE_FAILURES`, Factory stores a recoverable quarantine and
adds `factory-quarantined` plus `needs-human` once. A due circuit re-enters discovery automatically after the
bounded recovery window. Before discovery, Factory silently clears GitHub quarantine labels that are no longer
backed by durable quarantine state at startup and whenever a bounded circuit is released, so a partial recovery
cannot hide the job without adding a high-volume query to every scheduler refresh. To retry sooner, pause the daemon,
resolve the deterministic cause, run `backlog requeue-quarantined`, then resume. Use repeatable `--issue` options
for a targeted reset. Recovery is quiet by default; add `--announce` only when a lifecycle comment is useful. The
command reconciles the union of durable quarantine state and GitHub labels, so rerunning it safely completes a
partially interrupted reset. Historical quarantine entries without the current reason marker are migrated into
normal retry flow. Successful merge completion removes `factory-active` before closing the source issue. Existing
historical `factory-active` and retired `swarm-active` drift is cleaned in batches of
`FACTORY_LABEL_RECONCILIATION_BATCH_SIZE` per scheduler refresh. Durable active jobs and currently protected
workers retain ownership. Released issues always regain `factory-ready` because `factory-active` also carried
trusted-intake authority. The configured batch is validated between 1 and 100. This avoids an unbounded startup
mutation or GitHub comment burst while converging automatically.

Never restore the old swarm or create a parallel one-off resolver to bypass a red diagnostic.

For an emergency stop:

```bash
sudo systemctl disable --now hellotalk-factory.service hellotalk-factory-health.timer
```

## Upgrade, rollback, and shutdown

SIGTERM and SIGINT stop new scheduling, mark routing as stopping, terminate registered CLI, OpenHands, Git,
verification, and repository child process groups, wait for workers to release capacity, and persist the daemon as
stopped. TERM escalates to KILL after the configured grace period so a provider or repository command cannot
leave an orphaned process indefinitely.

Build upgrades in a versioned virtual environment, run the full Factory test and doctor gates, then atomically
switch the installed virtual environment. Roll back code, environment, and routing configuration together if
health fails. Never reset a human checkout, remove an unmerged branch, or edit durable JSON manually without a
preserved backup.

## Audit status and limitations

The current engineering review is [AUDIT-2026-08-17.md](AUDIT-2026-08-17.md). It separates implemented and tested
controls from production-host and paid-provider evidence. The Factory targets unattended operation, but it safely
stops agent progress when credentials need account-owner renewal, branch policy blocks merge, a product decision
is required, or no provider is usable. Cross-repository PRs are excluded from mutation because the repository
token cannot safely push fork branches.

Current limitations are explicit:

- CI repair receives failed check names and mergeability, not full GitHub Actions log excerpts;
- security review does not yet have a separate authoritative structured report;
- canonical required status names are repository constants; online doctor fails when repository rules do not
  require them;
- OpenHands inner-provider attribution is separate from outer adapter provenance;
- provider credential and runtime paths are operator-configured and must be reviewed whenever a CLI changes its
  installation or authentication layout;
- direct providers can read their own session and need vendor network access, so public intake must remain gated
  and a vendor-domain egress broker is recommended;
- status-context names are enforced, but source pinning requires a dedicated GitHub App identity and matching
  ruleset integration IDs;
- exact PAYG spend cannot be enforced where a provider does not expose cost;
- production is not proven until host activation and one small end-to-end canary complete.
