# Factory restoration record

This document records how the autonomous factory is assembled and how to recover it without deleting credentials, state or unfinished work.

## Canonical implementation

The active implementation is the OpenHands Factory in `automation/openhands_factory`, running on the VPS. Agent Canvas is the operator-facing OpenHands surface; the Factory owns durable GitHub scheduling and issue-to-merge lifecycle.

The production provider order is fixed:

1. OpenAI subscription authentication through OpenHands `LLM.subscription_login()` using `OPENHANDS_OPENAI_MODEL` for Codex.
2. OpenCode Go using `OPENCODE_GO_API_KEY`, `OPENCODE_GO_BASE_URL` and `OPENCODE_GO_MODEL`.

There is no third production model tier. `GEMINI_ENABLED=true` is rejected. The retired GitHub Actions AI swarm is historical only and must not be restored into the active checkout.

Production configuration must set:

```text
FACTORY_ARCHITECTURE=openhands-agent-canvas-v1
GEMINI_ENABLED=false
```

After acquiring `factory.lock`, the daemon creates a unique runtime generation in `generation.json` and stamps jobs, leases and provider attribution with it so stale daemons cannot keep writing state. Do not use the static architecture marker as that runtime UUID.

## Environment preservation

Never replace `/etc/hellotalk-factory/factory.env` with a shortened file. Merge changes into it and preserve existing secrets and operational settings. The source template is `config/systemd/factory.env.example`.

Before changing configuration:

```bash
sudo cp --preserve=mode,ownership,timestamps \
  /etc/hellotalk-factory/factory.env \
  /etc/hellotalk-factory/factory.env.backup
```

## Safe deployment

The repository checkout used by the service must be on `main` and clean of human changes. Do not reset a worktree containing factory work.

If the service environment contains duplicated developer paths or points at a developer home directory, repair it with the repository script:

```bash
REPOSITORY_ROOT="$(git rev-parse --show-toplevel)"
sudo "$REPOSITORY_ROOT/scripts/repair-factory-host.sh"
```

Rotate any credential exposed in terminal output before adding the replacement to `/etc/hellotalk-factory/factory.env`. Do not copy the application `.env` wholesale into the Factory environment.

Use the guarded startup path:

```bash
sudo ./scripts/start-factory.sh
```

The start script validates the active architecture, refuses `GEMINI_ENABLED=true`, verifies the systemd units, starts recovery supervision, and runs the online doctor.

Manual verification remains available:

```bash
sudo systemd-analyze verify /etc/systemd/system/hellotalk-factory.service
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
sudo systemctl status hellotalk-factory.service --no-pager
sudo journalctl -u hellotalk-factory.service -n 100 --no-pager
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory status
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory metrics
```

## Retired swarm

Commit history contains the old GitHub Actions swarm for forensic reference. Do **not** copy those workflows back into `.github/workflows/` and do not run the retired dispatchers, resolvers, reviewers, guardian or architect executors.

The current daemon has a single-owner startup guard. If known retired autonomous workflow files reappear in the active checkout, the OpenHands Factory refuses to start rather than risk two systems leasing and changing the same GitHub work.

Historical source recovery, if ever needed for investigation, should happen in a detached throwaway checkout that cannot execute GitHub Actions or share production Factory state.

## Emergency stop and resume

```bash
sudo systemctl disable --now hellotalk-factory.service
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory pause
```

Preserve `/var/lib/hellotalk-factory`, especially durable job/lease state, worktrees, conversations, provider attribution, provider health and generation metadata.

Resume only after the cause is understood and the production invariants pass:

```bash
sudo ./scripts/start-factory.sh
```

If doctor reports a degraded Podman compatibility fallback, repair the host/rootless-Podman setup rather than treating the weaker fallback as normal production isolation.
