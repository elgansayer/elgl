# Factory GitHub control panel

## Purpose

The Factory maintains one open GitHub issue titled `Factory control panel`, labelled `factory-status` and
`factory-skip`. The issue is a sanitised operational projection, not a second scheduler. The existing Factory
daemon remains the only owner of jobs, worktrees, provider routing, verification, review and merge decisions.

The panel avoids a new public HTTP listener, browser login system, inbound webhook and privileged self-hosted
runner. It works with the repository and service credentials the Factory already needs. The status issue is
excluded from task discovery by `factory-skip`.

## Data shown

The watchdog refreshes the panel on material state changes and at least every 15 minutes while the two-minute
health timer is running. The issue reports:

- Factory service and health-timer state;
- heartbeat age, runtime version and generation;
- pause state and up to ten active issue links;
- bounded queue totals and state counts;
- enabled providers, transport, selected model, last observed health and retry time;
- aggregate calls, successes, failures, fallbacks, rate limits, authentication failures, quota failures,
  timeouts and bounded typed failure classes;
- root and Factory-state storage use, free-space reserve, health, and bounded trend projection.

The top indicator is healthy only when the daemon heartbeat and recovery timer are current and at least one
enabled provider is healthy or degraded-but-routable. A running daemon with every provider disabled,
unauthenticated, cooling down or unavailable is shown as degraded rather than green.

A warning, critical, or unreadable root or Factory-state volume also prevents a green top indicator. Storage
projection compares adjacent watchdog samples only after a meaningful decline, so it is an early warning rather
than a capacity guarantee. See [HOST-STORAGE.md](HOST-STORAGE.md) for thresholds, retention and recovery.

The panel never includes prompts, transcripts, issue bodies, environment variables, raw provider diagnostics,
credential paths, tokens or raw exception text. A stale panel timestamp is a dead-man signal: it means the
watchdog, host or GitHub publishing path may be unavailable even if the last displayed state was green.

## Controls

Post one exact comment on the status issue:

```text
/factory status
/factory pause
/factory resume
/factory restart
```

Only actors listed in `FACTORY_CONTROL_GITHUB_ACTORS` are accepted. Matching is case-insensitive. This list is
separate from `FACTORY_TRUSTED_GITHUB_ACTORS`, so an application or workflow allowed to create tasks cannot control
the daemon. Unrecognised, partial, combined and untrusted comments are ignored. The comment body is never executed
or interpolated into a shell command.

`pause` and `resume` update the same durable `control.json` consumed by the daemon. Pausing stops new scheduling
without terminating active jobs. `status` forces an immediate panel refresh.

`restart` creates a mode-0600, `dev`-owned request containing only the fixed action, GitHub comment ID,
trusted actor and timestamp. The root watchdog accepts it only when:

- the path is a regular non-symlink file;
- it is owned by `dev` and is not group- or world-writable;
- the JSON schema contains the literal action `restart`;
- the request has a numeric comment ID and named actor;
- the timezone-aware timestamp is no more than ten minutes old and no more than two minutes in the future.

The watchdog unlinks a valid request before restarting, making it single-use. The panel cannot run arbitrary
commands, select tasks, alter routes, edit jobs, push branches, approve reviews or merge pull requests.

## Lifecycle

`hellotalk-factory-health.timer` invokes `dashboard sync` during each two-minute watchdog cycle. A normal healthy
cycle performs GitHub reads but writes only when state changed or the 15-minute heartbeat is due. If the daemon is
down, recovery runs before the non-critical GitHub publication attempt. The independent root watchdog can still
publish `offline`, process one trusted restart request and perform its existing bounded recovery attempts.

The first successful sync creates the issue. Later syncs locate it by exact title plus the maintainer-controlled
`factory-status` label. A public issue with the same title cannot capture updates without that label.

## Local diagnostics

Render the current panel without contacting GitHub:

```bash
sudo -u dev \
  /opt/hellotalk-factory/venv/bin/hellotalk-factory dashboard show
```

Force a publish and command poll:

```bash
sudo -u dev \
  /opt/hellotalk-factory/venv/bin/hellotalk-factory dashboard sync --force
```

The command returns the issue URL, displayed state, whether a write occurred and any accepted action. Routine
timer output is suppressed in the system journal, while failures remain visible.

## Deployment and recovery

Deploying from `main` installs the watchdog integration automatically:

```bash
git switch main
git pull --ff-only origin main
sudo scripts/deploy-and-start-factory.sh --use-existing-credentials
```

For a repeated unchanged deployment, add `--fast`. The verified fast path preserves all startup and online
diagnostics while reusing only dependency trees and the worker image whose deployment fingerprints still match.
Its first run performs the normal expensive phases to establish trusted cache records.

Startup diagnostics use the exact `HOME` and `PATH` configured on `hellotalk-factory.service`. Do not diagnose
provider installation with a bare `sudo -u dev` command: sudo's secure path can hide the authenticated CLI
binaries even while the daemon is using them successfully.

Deployment also installs the bounded persistent-journal policy and vacuums archived entries. It does not prune
Docker automatically. Inspect or perform the separately bounded host maintenance command as documented in
[HOST-STORAGE.md](HOST-STORAGE.md). The deploy exit trap restores the daemon and watchdog when an upgrade fails
after entering its maintenance window, provided each unit was active before deployment began.

After deployment, confirm that the panel issue exists and that its service, timer and heartbeat rows are green.
If publication fails, run `dashboard sync --force` as `dev` and inspect the health service journal:

```bash
sudo journalctl -u hellotalk-factory-health.service -n 100 --no-pager
```

GitHub failure never prevents watchdog recovery. It only removes remote visibility and control until the next
successful sync. Existing CLI, doctor, logs and systemd commands remain authoritative recovery tools.

## Future web dashboard

An Angular page in the authenticated admin portal can later read the same sanitised snapshot through a bounded
NestJS endpoint. It should not read Factory state files directly or become a second command processor. Add that
surface only when the backend has a signed status-ingestion contract, stale-data semantics, admin capability
checks and an audit record for every mutation. Until then, the GitHub issue provides the smallest useful remote
surface with no new inbound network exposure.
