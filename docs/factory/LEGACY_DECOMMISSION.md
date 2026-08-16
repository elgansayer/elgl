# Retired AI Swarm Decommissioning

The active autonomous coding system is the OpenHands Factory daemon on the VPS. Codex through ChatGPT/OpenAI subscription OAuth is primary and OpenCode Go is the fallback for a fresh conversation. The pre-OpenHands swarm has no runtime authority.

## Detection

Run:

```bash
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory legacy scan
sudo -u hellotalk-factory /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
```

The detector checks known retired HelloTalk swarm systemd units, old tmux orchestration sessions and legacy state locations. An active or enabled retired service/session fails the doctor check. Inactive legacy state is reported as a warning because historical evidence may still be useful.

Legacy queues, leases and databases are never imported into current Factory state. GitHub issues and the current Factory state directory remain the only work authorities.

## Safe cleanup

Preview decommission actions first:

```bash
sudo bash ./scripts/decommission-legacy-factory.sh
```

After reviewing the output:

```bash
sudo bash ./scripts/decommission-legacy-factory.sh --apply
```

The helper is deliberately conservative. It disables/stops known retired systemd units, terminates known retired tmux sessions, and makes detected legacy state read-only. It does not delete state and it does not touch `/var/lib/hellotalk-factory`, current Factory worktrees, OAuth credentials, or human branches.

After applying cleanup, run `legacy scan` and `doctor --online` again. A clean production host has no active or enabled retired runtime findings.

## Adding newly discovered legacy artifacts

If another retired unit/session/path is discovered, add its precise HelloTalk-specific identifier to `automation/openhands_factory/legacy_runtime.py` and the decommission helper, with tests. Avoid broad process names that could match unrelated host software.

Historical documentation may describe the old architecture, but executable configuration must never reactivate it. New orchestration belongs inside `automation/openhands_factory` and follows `docs/factory/ACTIVE_ARCHITECTURE.md`.
