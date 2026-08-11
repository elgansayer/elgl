# HelloTalk OpenHands Factory Runbook

## Architecture and threat model

The controller leases work, builds task-specific context, communicates with providers, records metrics and
brokers GitHub operations. Terminal calls run in rootless Podman without controller credentials. File editor
calls are constrained to the canonical task worktree. One conversation handles one task.

Issues, pull requests, source comments, logs and documentation are untrusted. They cannot override security
policy. Agent processes receive no OAuth, API, GitHub or Telegram credentials. Path escapes, direct protected
branch pushes, hook bypass, administrator merges, staged secrets and conflict markers are rejected.

The provider order is ChatGPT Plus `gpt-5.6-sol`, OpenCode Go `deepseek-v4-flash`, then Gemini
`gemini-3.6-flash`. SDK fallback covers recognised transient LLM-call errors. The outer health controller
handles credentials, model compatibility, budgets, malformed responses and open circuits.

The former Aider, DeepSeek, swarm watchdog, guardian, resolver and reviewer automation was removed. Issue intake,
repair, review, health and merge responsibilities move into the factory and protected CI. New work enters through
GitHub issues; the daemon does not invent duplicate planning issues.

## Costs

ChatGPT Plus is approximately USD 20 monthly and does not include ordinary OpenAI API usage. OpenHands Go is
budgeted at USD 10 monthly. The VPS is approximately USD 5 monthly. Gemini uses the free tier only, with
billing disabled and variable budget USD 0. The steady operating ceiling is USD 35, not USD 30. Unknown-cost
subscription calls are counted separately.

Free-tier Gemini content may be used by Google to improve its products. Never send secrets, production data,
private keys, environment files, OAuth caches or database dumps to an LLM.

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

Force renewal with `hellotalk-factory auth openai --force`. If OAuth is revoked, the factory alerts through
Telegram and runs OpenCode-only for at most 24 hours before pausing. Account-owner action is the sole
authentication break-glass exception.

## Providers and doctor

Store credentials only in `/etc/hellotalk-factory/factory.env`, never in commands or chat.

`FACTORY_MAX_PARALLEL_JOBS` defaults to three. Issue agents implement and review in
parallel, while the memory-heavy local verification suite is serialised for safe operation on
the 4 GB VPS. Increase this only after increasing the systemd memory limit and available RAM.

```bash
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory models opencode-go
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory models gemini
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
```

Discovery must list both configured models. A missing model, invalid credential, paid-tier response or
unexpected endpoint response blocks activation.

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

- `doctor --online` verifies tooling, writable state directories, disk headroom, the systemd unit and live
  provider endpoints. It also launches a constrained rootless worker-terminal smoke container and fails for
  a stale daemon heartbeat, quarantined jobs or jobs stalled beyond the conversation deadline.
- If the host cannot delegate nested cgroups to rootless Podman, the worker smoke test and terminal executor
  retry without nested CPU, memory and PID flags. Network isolation, dropped capabilities, no-new-privileges,
  user namespaces and worktree confinement remain enabled, while the systemd service limits the factory as a
  whole.
- If the host blocks `newuidmap` for the diagnostic smoke test, doctor retries that diagnostic only with a
  host namespace and labels the result. Actual agent terminals continue to use `keep-id` isolation.
- `providers check` reports the PASS or FAIL state of each configured provider, which isolates a blocked
  activation.
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
