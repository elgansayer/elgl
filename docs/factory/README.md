# HelloTalk OpenHands Factory Runbook

## Architecture and threat model

The controller leases work, builds task-specific context, communicates with providers, records metrics and
brokers GitHub operations. Terminal calls run in rootless Podman without controller credentials. File editor
calls are constrained to the canonical task worktree. One conversation handles one task.

Issues, pull requests, source comments, logs and documentation are untrusted. They cannot override security
policy. Agent processes receive no OAuth, API, GitHub or Telegram credentials. Path escapes, direct protected
branch pushes, hook bypass, administrator merges, staged secrets and conflict markers are rejected.

OpenHands Agent Canvas is the sole autonomous execution control plane. Every Factory phase is routed through the
owned OpenHands provider boundary and a bounded `ConversationRunner`; direct Claude Code, Codex CLI, Google
Agent and OpenCode CLI adapters are not production routing peers. Inside each OpenHands conversation, provider
selection is conversation-stable and follows the authoritative model chain: OpenAI subscription OAuth / Codex
first, then OpenCode Go as the only production fallback. If both are unavailable, the Factory fails closed and
returns the task to bounded retry/recovery instead of dispatching a historical third provider. See
`docs/factory/execution-architecture.md` for the enforced architecture contract.

The default rollout is autonomous: `FACTORY_REQUIRE_READY_LABEL=false` remains the default and no `factory-ready`
label is needed. Provider failures are recorded durably, provider circuit breakers suppress hot retries, and the
next OpenHands attempt can use the other healthy production model provider. Repository and task failures are
returned to verification or repair instead of being blindly rotated between autonomous agent systems.

Run `hellotalk-factory doctor` to see the OpenHands control-plane status, OpenAI OAuth health, OpenCode model
compatibility, and provider breaker state. The diagnostic never starts an agent session and never prints
credentials.

The former Aider, DeepSeek, swarm watchdog, guardian, resolver and reviewer automation was removed. Issue intake,
repair, review, health and merge responsibilities move into the factory and protected CI. New work enters through
GitHub issues; the daemon does not invent duplicate planning issues.

Every implementation runs a dedicated security review workflow before the branch is verified. A bounded agent
conversation (`automation/prompts/security.md`) inspects the diff for hardcoded secrets, webhook signature
weaknesses, client-controlled privileged state, authentication and authorisation gaps, injection and unsafe
security configuration. It fixes confirmed findings with tests or leaves the worktree unchanged, and the normal
verification gate then runs on the combined diff before the pull request is opened.

## Issue Intake and Classification

By default, the factory operates with `FACTORY_REQUIRE_READY_LABEL=false`, meaning all open issues not specifically excluded are picked up. Use `factory-ready` only if you enable `FACTORY_REQUIRE_READY_LABEL=true` for manual queueing.

Excluded from implementation:
- `factory-epic`: Broad outcomes (e.g., "Improve onboarding").
- `factory-planning`: Architecture mapping, research, or decomposition.

## Deterministic Quality Gate

Before a pull request is created, the factory runs a deterministic quality gate on the implementation diff to detect incomplete work. The gate checks for:
- Mock/fake/stub production behaviour.
- Obvious placeholder implementations (e.g., "TODO: implement").
- Unsafe type escapes (`as any`, `<any>`).
- Newly skipped tests.

If blocked, the factory executes one bounded quality-repair pass before failing closed.

## Independent Review

The independent reviewer proves actual completion against the issue's requirements and writes a structured `.factory-review.json` report. The review checks:
- Structured review report validity.
- Acceptance criteria coverage (every explicit bullet must pass).
- Absence of blocking findings (e.g., UI without backend).
- Reviewed SHA integrity (the approved SHA must match the PR head).

Review remains inside OpenHands. When both production model providers are healthy, review prefers the provider not
used for implementation so that provider diversity does not require a second execution control plane.

## Costs

Subscription-backed OpenAI OAuth and OpenCode Go are the only production model-provider path. Ordinary OpenAI
API PAYG usage is not part of the default Factory route. Gemini is retired from production execution and must not
be enabled as a fallback. Provider usage and capacity are recorded separately so the operator can audit the
actual route without exposing credentials.

## Bootstrap

Keep at least 5 GB free for worktrees, dependency caches and build output. The reserve is configurable with
`FACTORY_MINIMUM_FREE_DISK_GIB`; the factory pauses before starting new work when the reserve is breached.

```bash
REPOSITORY_ROOT="$(git rev-parse --show-toplevel)"
sudo "$REPOSITORY_ROOT/setup-debian.sh"
sudoedit /etc/hellotalk-factory/factory.env
sudo chmod 0640 /etc/hellotalk-factory/factory.env
sudo chown root:hellotalk-factory /etc/hellotalk-factory/factory.env
```

The idempotent bootstrap supports Debian 13, Ubuntu 24.04 and Ubuntu 26.04. It uses `npm ci`, creates a
dedicated user, installs rootless Podman and a versioned Python environment, and never overwrites credentials.

## ChatGPT subscription authentication

Complete OAuth before enabling systemd:

```bash
tmux new -s hellotalk-auth
sudo -u hellotalk-factory env HOME=/var/lib/hellotalk-factory/home \
  /opt/hellotalk-factory/venv/bin/hellotalk-factory auth openai
```

Copy the printed URL, open it locally and complete consent. Detach using `Ctrl-b d` and reattach with
`tmux attach -t hellotalk-auth`. The cache is `/var/lib/hellotalk-factory/home/.openhands/auth`, owned by
`hellotalk-factory`, mode `0600`, beneath a mode `0700` directory.

Force renewal with `hellotalk-factory auth openai --force`. If OAuth is revoked or cooling down, the Factory can
continue through OpenCode Go while its breaker permits calls. If both production providers are unavailable, the
job remains recoverable and is retried with bounded backoff; no direct coding-agent CLI or retired swarm is used
as an emergency bypass. Account-owner action is the sole authentication break-glass exception.

## Providers and doctor

Store credentials only in `/etc/hellotalk-factory/factory.env`, never in commands or chat.

`FACTORY_MAX_PARALLEL_JOBS` defaults to five for the current 8 GB/4 vCPU host. Issue agents implement and
review in parallel, while the memory-heavy local verification suite is serialised. Reduce this to two or
three if swap usage grows; increase it only after measuring memory and CPU saturation.

All open issues are eligible by default. `needs-human`, `factory-skip` and `duplicate` always exclude an
issue. Set `FACTORY_REQUIRE_READY_LABEL=true` if manual queueing is preferred.

Historical quarantined state is migration-only. Active production failures remain recoverable through bounded
backoff and provider circuit breakers rather than entering a permanent quarantine terminal state. If old durable
state still references a quarantined worktree, recovery preserves uncommitted work under
`/var/lib/hellotalk-factory/recovery/` before removing the worktree registration; branches are never silently
deleted.

```bash
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory models opencode-go
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
```

Activation must verify OpenAI subscription OAuth health and the configured OpenCode Go model catalogue. A
missing model, invalid credential, unexpected endpoint response or open provider circuit blocks that provider
without enabling a historical third production route.

## systemd and operator commands

```bash
sudo systemd-analyze verify /etc/systemd/system/hellotalk-factory.service
sudo systemctl enable --now hellotalk-factory.service hellotalk-factory-health.timer
sudo systemctl status hellotalk-factory.service
sudo journalctl -u hellotalk-factory.service -f
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory pause
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory metrics
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory reconcile
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory resume
```

Both units are enabled system-wide and the health timer is persistent, so the daemon and health checks start
again after a machine reboot. Verify this with `systemctl is-enabled hellotalk-factory.service
hellotalk-factory-health.timer` after deployment.

Emergency stop: `sudo systemctl disable --now hellotalk-factory.service hellotalk-factory-health.timer`.

Use a fine-grained GitHub token limited to repository metadata read, Actions read, contents read/write, issues
read/write and pull requests read/write. The factory uses its cached backlog during GitHub outages and honours
rate-limit reset times.

## Operator recovery

When providers degrade or a task stalls, run these commands as the `hellotalk-factory` user from the service
virtualenv:

```bash
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory status
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory metrics
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory reconcile
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory pause
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory resume
```

- `doctor --online` verifies tooling, writable state directories, disk headroom, the systemd unit, OpenHands
  control-plane readiness and live production model-provider prerequisites. It also launches a constrained
  rootless worker-terminal smoke container and fails for a stale daemon heartbeat or work stalled beyond the
  conversation deadline.
- If the host cannot delegate nested cgroups to rootless Podman, the worker smoke test and terminal executor
  retry without nested CPU, memory and PID flags. Network isolation, dropped capabilities, no-new-privileges,
  user namespaces and worktree confinement remain enabled, while the systemd service limits the factory as a
  whole.
- Cgroup delegation itself depends on the `hellotalk-factory` user having a real systemd user session:
  `loginctl enable-linger hellotalk-factory` creates `user@<uid>.service`, and the unit's
  `XDG_RUNTIME_DIR=/run/user/<uid>` points Podman at it. Without both, Podman falls back to a cgroupfs mode
  that races and intermittently fails container creation under concurrent worker load rather than reliably
  hitting the degraded-limits fallback above. `<uid>` is the `hellotalk-factory` user's uid on the host
  (`id -u hellotalk-factory`) and must match the unit file if a fresh install assigns a different one.
- If the host blocks `newuidmap` for the diagnostic smoke test, doctor retries that diagnostic only with a
  host namespace and labels the result. Actual agent terminals continue to use `keep-id` isolation.
- `providers check` reports the PASS or FAIL state of the production provider prerequisites and control-plane
  configuration, which isolates a blocked activation without starting an agent session.
- `status` prints the daemon state from `daemon.json` (`running`, `stopped` or `unknown`).
- `metrics` prints the recorded provider usage and cost snapshot from `metrics.json`.
- `reconcile` releases expired durable leases and never deletes branches or worktrees.
- Doctor alerts through Telegram when active work has produced no pull request for
  `FACTORY_MAX_NO_PR_HOURS` (default six hours).
- `pause` stops the daemon from starting new work while preserving jobs, branches and pull requests.
- `resume` re-enables scheduling once the underlying issue is resolved.

Typical recovery flow: run `doctor --online` to confirm the failure, `providers check` to isolate the provider,
`status` and `metrics` to review daemon health and recent fallbacks, `pause` before touching credentials or
state, then `resume` after the fix.

## Wiki, upgrades and recovery

Every feature pull request must update application documentation. The deterministic wiki publisher derives
pages from routes, modules, APIs, migrations, integrations and tests. An issue title is never evidence that a
feature exists, and generated wiki content never pushes to application `main`.

Build upgrades in `/opt/hellotalk-factory/venv-VERSION`, run tests and doctor, atomically change the `venv`
symlink, restart and roll back the symlink if health fails.

For a damaged worktree, pause the factory, preserve its branch and logs, remove only the named factory-owned
worktree with `git worktree remove`, prune worktree metadata and resume. Never reset the human checkout or
delete an unmerged branch. Full rollback disables the units and restores the prior factory version while
leaving all task branches and pull requests recoverable.
