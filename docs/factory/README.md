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
- every enabled subscription CLI is installed and authenticated as `hellotalk-factory`;
- trusted intake is enabled for this public repository, with every automatic actor explicitly listed;
- `hellotalk-factory providers check` reports at least one usable provider before an activation canary;
- `hellotalk-factory doctor --online` passes;
- one active GitHub ruleset without bypass actors requires pull requests, `CI / required`, and
  `factory/independent-review` on `main`;
- the required statuses are pinned to their expected GitHub App sources before any additional write actor is
  trusted;
- `hellotalk-factory legacy scan` reports no active competing executor;
- non-paid diagnostics prove configuration, fallback, circuit, structured-output, and stale-SHA behaviour;
- one deliberately small issue completes issue, implementation, review, CI, merge, and closure end to end.

Do not infer authentication from a developer login. systemd uses `HOME=/var/lib/hellotalk-factory/home`, so each
CLI session must exist and be readable in that service home.

Temporary exhaustion of every provider does not stop an already configured daemon. `providers check` reports
`agent-usable` as a warning, the durable queue remains online, and jobs wait for the earliest provider recovery.
An initial production activation still needs one usable provider because the required end-to-end canary cannot
otherwise run.

The 2026-08-17 audit found the inspected host still failed and found a pull request merged without Factory review
or status provenance. Treat production as inactive until every activation blocker in
[AUDIT-2026-08-16.md](AUDIT-2026-08-16.md) is cleared. A green repository revision is not an operational canary.

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

See [ACTIVE_ARCHITECTURE.md](ACTIVE_ARCHITECTURE.md), [AGENT-ROUTING.md](AGENT-ROUTING.md), and
[SUBSCRIPTION-AGENTS.md](SUBSCRIPTION-AGENTS.md) for the detailed contract.

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

Provider exhaustion does not consume a task attempt. The job remains in its current state with `next_attempt_at`
set from provider cooldown or capacity. Repository, test, task, and policy failures do not trigger blind provider
rotation. Persisted failure classes and deterministic jittered backoff remain authoritative across restart.

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
- SHA-scoped `factory/independent-review` status, reset to `PENDING` before every PR-backed AI phase, refresh, or
  base update;
- head-SHA comparison before the scheduled merge queue;
- atomic base updates and renewed verification/review when a head is behind `main`;
- atomic `--match-head-commit` enforcement at the merge call;
- literal success for `CI / required` and `factory/independent-review`;
- one active, no-bypass GitHub ruleset requiring pull requests and those two statuses before any account can merge
  to `main`;
- human `CHANGES_REQUESTED` review blocking;
- no administrator merge bypass.

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
credentials are not replaced or printed.

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

Use the service-user environment for every check:

```bash
FACTORY_HOME=/var/lib/hellotalk-factory/home
FACTORY_PATH="$FACTORY_HOME/.local/bin:$FACTORY_HOME/.opencode/bin:$FACTORY_HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin"
sudo -u hellotalk-factory env HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" claude auth status
sudo -u hellotalk-factory env HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" codex login status
sudo -u hellotalk-factory env HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" opencode auth list
sudo -u hellotalk-factory env HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" agy models
```

Authenticate each CLI manually once as `hellotalk-factory`. Do not copy another user's home or fixed credential
directories. Do not place provider tokens in `factory.env` when the adapter is configured for subscription auth.
Common API-key variables are stripped from direct subscription-provider environments so they cannot silently
switch to PAYG authentication.

Google Antigravity remains disabled until `agy models`, doctor, and one harmless headless service-user canary all
pass. Gemini CLI remains configurable only for account types where Google still supports that path. Provider
installation and authentication details are in [SUBSCRIPTION-AGENTS.md](SUBSCRIPTION-AGENTS.md).

## Diagnostics

```bash
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory status
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory metrics
sudo systemctl status hellotalk-factory.service hellotalk-factory-health.timer
sudo journalctl -u hellotalk-factory.service -n 200 --no-pager
```

- `providers check` is the bounded, read-only systemd preflight. It reports enabled state, executable and
  authentication health, transport, selected model, current-generation concurrency, cooldown, aggregate provider
  usability, competing executors, authenticated repository access, and the no-bypass GitHub merge policy. An
  optional OpenAI OAuth failure is a warning when another configured provider is usable.
- `doctor --online` checks architecture ownership, state, disk, daemon heartbeat, rootless worker isolation,
  provider and verification namespaces, providers, absence of persistent service-home GitHub credentials, the
  scoped Git credential helper, authenticated GitHub repository reads, and a no-bypass server-side merge policy.
- `status` prints the durable daemon generation, queue counts, active jobs, and heartbeat.
- `metrics` prints provider, model, and phase outcomes without transcripts or credentials.
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
a real systemd user session for `hellotalk-factory`:

```bash
sudo loginctl enable-linger hellotalk-factory
id -u hellotalk-factory
```

`XDG_RUNTIME_DIR` in the unit must match `/run/user/<uid>`. If nested cgroup controller flags are unavailable,
the diagnostic worker retries without per-container CPU, memory, and PID flags while preserving no-network,
user-namespace, dropped-capability, and worktree confinement. Actual agent terminals continue to use `keep-id`
isolation. A host-namespace fallback is permitted only for the read-only smoke diagnostic when `newuidmap` is
blocked.

## Operator recovery

Run recovery commands as the service user from the installed virtual environment:

```bash
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory status
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory metrics
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory reconcile
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory pause
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory resume
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory backlog requeue-quarantined
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
adds `factory-quarantined` plus `needs-human` once. Pause the daemon, resolve the deterministic cause, run
`backlog requeue-quarantined`, then resume. The command reconciles the union of durable quarantine state and
GitHub labels, so rerunning it safely completes a partially interrupted reset. Historical quarantine entries
without the current reason marker are migrated into normal retry flow.

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

The current engineering review is [AUDIT-2026-08-16.md](AUDIT-2026-08-16.md), updated on 2026-08-17. It separates
implemented and tested controls from production-host and paid-provider evidence. The Factory targets unattended
operation, but it safely stops agent progress when credentials need account-owner renewal, branch policy blocks
merge, a product decision is required, or no provider is usable. Cross-repository PRs are excluded from mutation
because the repository token cannot safely push fork branches.

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
