# Factory restoration record

This document records how the autonomous factory is assembled and how to
recover it without deleting credentials, state or unfinished work.

## Canonical implementation

The active implementation is the OpenHands SDK factory in
`automation/openhands_factory`. It uses these providers in order:

1. OpenAI subscription authentication using `OPENHANDS_OPENAI_MODEL`.
2. OpenCode Go using `OPENCODE_GO_API_KEY`, `OPENCODE_GO_BASE_URL` and
   `OPENCODE_GO_MODEL`.
3. Gemini free tier using `GEMINI_API_KEY` and `GEMINI_MODEL` when enabled.

The daemon reads GitHub issues, leases work, creates isolated worktrees,
runs bounded SDK conversations, verifies changes, creates and reviews pull
requests, repairs failed checks and enables normal squash auto-merge.
It intentionally consumes existing GitHub issues rather than creating planning
issues that could re-enter its own queue as duplicate work.

## Environment preservation

Never replace `/etc/hellotalk-factory/factory.env` with a shortened file.
Merge changes into it and preserve every existing variable. The source
template is `config/systemd/factory.env.example` and currently includes:

- repository and state paths;
- OpenAI, OpenCode Go and Gemini provider settings;
- all monthly and per-task budget controls;
- task timeout, retry, concurrency and cooldown controls;
- disk reserve and Podman settings;
- GitHub repository and token settings;
- optional Telegram alert settings.

Before changing configuration:

```bash
sudo cp --preserve=mode,ownership,timestamps \
  /etc/hellotalk-factory/factory.env \
  /etc/hellotalk-factory/factory.env.backup
```

## Safe deployment

The repository checkout used by the service must be on `main` and clean of
human changes. Do not reset a worktree containing factory work. The bootstrap
script installs the SDK, worker image, service units and all existing Node
dependencies. It does not overwrite an existing environment file.

After editing credentials, validate before starting:

```bash
sudo systemd-analyze verify /etc/systemd/system/hellotalk-factory.service
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
```

Then enable the daemon and health timer:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now hellotalk-factory.service
sudo systemctl enable --now hellotalk-factory-health.timer
```

Verify operation:

```bash
sudo systemctl status hellotalk-factory.service --no-pager
sudo journalctl -u hellotalk-factory.service -n 100 --no-pager
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory status
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory metrics
```

## Historical recovery point

Commit `7569bf64` introduced the SDK factory and replaced the earlier GitHub
Actions swarm. The old workflows remain recoverable from `7569bf64^`:

```bash
git archive 7569bf64^ .github/workflows/architect.yml \
  .github/workflows/auto-dispatcher.yml \
  .github/workflows/openhands.yml \
  .github/workflows/pr-reviewer.yml \
  .github/workflows/resolver-fast.yml \
  .github/workflows/reviewer-fast.yml \
  .github/workflows/dispatcher-batch.yml \
  .github/workflows/guardian.yml \
  > /tmp/openhands-actions-history.tar
```

Do not restore those workflows into the active tree without first disabling
the SDK daemon and designing an explicit single-owner transition. Running both
systems would lease and implement the same issue independently.

## Emergency stop and resume

```bash
sudo systemctl disable --now hellotalk-factory.service
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory pause
```

Preserve `/var/lib/hellotalk-factory`, especially `jobs.json`, `leases.json`,
`worktrees/`, `conversations/` and provider health state. Resume only after
the cause is understood:

```bash
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
sudo systemctl enable --now hellotalk-factory.service
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory resume
```
