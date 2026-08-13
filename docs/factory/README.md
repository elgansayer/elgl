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

Every implementation runs a dedicated security review workflow before the branch is verified. A bounded agent
conversation (`automation/prompts/security.md`) inspects the diff for hardcoded secrets, webhook signature
weaknesses, client-controlled privileged state, authentication and authorisation gaps, injection and unsafe
security configuration. It fixes confirmed findings with tests or leaves the worktree unchanged, and the normal
verification gate then runs on the combined diff before the pull request is opened.

## Issue Intake and Classification

For unattended operation, the factory operates with `FACTORY_REQUIRE_READY_LABEL=false`, meaning no human `factory-ready` labelling step is required. Open issues not specifically excluded are picked up automatically. Setting it to `true` is an optional manual-queueing mode and is not used by the autonomous deployment.

Excluded from implementation:
- `factory-epic`: Broad outcomes (e.g., "Improve onboarding").
- `factory-planning`: Architecture mapping, research, or decomposition.
- `factory-quality-blocked`: Issues held back by a quality decision.
- `factory-quarantined`, `needs-human`: Legacy failure markers. The factory no longer adds these labels
  itself (see below); they only matter for issues a human has labelled that way on purpose, or for issues
  quarantined before this behaviour changed.
- `swarm-active`: Claimed by the separate GitHub Actions Swarm pipeline, to avoid two systems working the
  same issue at once.
- `duplicate`: Issues sharing an identical title with a lower-numbered issue are closed and labelled
  automatically on every backlog refresh, so the factory never implements the same work twice.

There is no permanent give-up state. A task that keeps failing is retried indefinitely with exponential
backoff (5 minutes, doubling up to a 24-hour cap) instead of being quarantined - see "Failure handling"
below. Telegram is paged (batched, see "Costs" below) but nothing requires a human to unblock it.

## Pull Request Intake

The factory also independently reviews, fixes and merges pull requests it did not create itself (from
other bots or humans), not just the ones it opens from issues. `collect_open_pull_requests` picks up every
open, non-draft pull request except:
- Its own, identified by a `factory/*` head branch (those are already tracked by the issue that opened
  them).
- Anything already labelled `factory-reviewed` or `factory-skip`.

A picked-up pull request skips straight to the review phase - there is no re-implementation step - and then
reuses the same review, CI-repair and merge state machine as an issue-driven job, including the same
`factory-merge.yml` gate. The only structural difference is that repair commits push back to the pull
request's own existing branch instead of a new `factory/*` one; `ensure_push_target` allows this only for
the exact branch a job is assigned to review; this is still trusted-code-directed, not open to indirect LLM
influence, and pushing to `main`/`master`/the base branch stays forbidden unconditionally.

## Deterministic Quality Gate

Before a pull request is created, the factory runs a deterministic quality gate on the implementation diff to detect incomplete work. The gate checks for:
- Mock/fake/stub production behaviour.
- Obvious placeholder implementations (e.g., "TODO: implement").
- Unsafe type escapes (`as any`, `<any>`).
- Newly skipped tests.

The gate inspects only newly added diff lines in production paths. Test fixtures and test-only mocks remain allowed.

If blocked, the factory executes up to two bounded quality-repair passes before treating it as a normal
failure (see "Failure handling").

## Independent Review

The independent reviewer proves actual completion against the issue's requirements and writes a structured `.factory-review.json` report. The review checks:
- Structured review report validity.
- Acceptance criteria coverage (every explicit bullet must pass).
- Absence of blocking findings (e.g., UI without backend).
- Reviewed SHA integrity (the approved SHA must match the PR head).

The reviewer report must contain the exact current head SHA, non-empty evidence for every criterion, and no
unrequested criteria. Reviewer edits trigger verification and a fresh review before approval is published.

## Failure handling

There is no quarantine terminal state. When a job fails (a conversation error, a verification failure, a
blocked quality gate), it stays in its current phase and is retried later rather than being marked done,
failed, or handed off to a human:
- Backoff is exponential per job: 5 minutes after the first failure, doubling on each subsequent one, capped
  at 24 hours. `select_batch` in `daemon.py` skips a job until its `next_attempt_at` has passed.
- One exception: if implementation repeatedly produces an empty diff (`"no repository changes"`), that is
  treated as the work already being done, usually by another pipeline racing on the same issue, and the
  issue is closed instead of retried forever for no reason.
- Once `FACTORY_MAX_CONSECUTIVE_FAILURES` (default 3) is reached, an alert fires. This is informational, not
  a call to action - the factory keeps retrying on its own. Alerts are batched (see "Operator recovery").
- If a systemic bug caused a wave of failures and you fixed it, issues already in backoff resume on their
  own schedule with no extra step. Only GitHub-side `needs-human`/`factory-quarantined` labels from before
  this behaviour changed, or added manually, need `backlog requeue-quarantined` to clear.

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

`FACTORY_MAX_PARALLEL_JOBS` defaults to five for the current 8 GB/4 vCPU host. Issue agents implement and
review in parallel, while the memory-heavy local verification suite is serialised. Reduce this to two or
three if swap usage grows; increase it only after measuring memory and CPU saturation.

All open issues are eligible by default. `needs-human`, `factory-skip` and `duplicate` always exclude an
issue. Set `FACTORY_REQUIRE_READY_LABEL=true` if manual queueing is preferred.

When a quarantined issue has an uncommitted worktree, the daemon archives it under
`/var/lib/hellotalk-factory/recovery/` before removing the Git worktree registration. The branch is never
deleted, so a human can restore the work later.

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
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory backlog requeue-quarantined
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
- `backlog requeue-quarantined` clears `factory-quarantined`, `needs-human`, `swarm-active` and
  `factory-active` from every currently quarantined issue and comments to explain why. This is only needed
  for issues carrying those labels from before quarantine stopped being a terminal state, or ones a human
  labelled that way by hand - see "Failure handling" for how ordinary retries now recover on their own.

Typical recovery flow: run `doctor --online` to confirm the failure, `providers check` to isolate the provider,
`status` and `metrics` to review daemon health and recent fallbacks, `pause` before touching credentials or
state, fix the root cause, `backlog requeue-quarantined` if any issues carry legacy quarantine labels, then
`resume`.

Duplicate issues (identical titles, usually from a bulk-generation run) are now detected and closed
automatically on every backlog refresh, not just during manual recovery.

Alerts are batched: repeated alerts of the same kind within a 30-minute window collapse into the first
message, with the suppressed count reported on the next alert that actually sends. A burst of failures
sends one Telegram message, not one per issue.

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
