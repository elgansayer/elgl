# OpenHands Factory: next session handoff

Date saved: 2026-08-11

## Current state

The active implementation is the multi-agent orchestration layer inside the OpenHands SDK daemon. The factory branch is `factory/update-dynamic-tasks` and the latest changes refactor the pipeline to use `AgentRouter`.

We have successfully integrated a provider-agnostic agent routing layer (`agents/router.py`) capable of using Claude Code, OpenAI Codex CLI, Google Agent (Gemini/ACP), OpenCode Go, and legacy OpenHands through a policy-based dispatcher (`agents/policy.py`). This allows the factory to leverage local subscription tools as the primary drivers while gracefully handling fallbacks and error handling without assuming a single LiteLLM backend.

Unrelated application edits and scratch files remain uncommitted and must not be staged or removed.

Factory-only verification currently passes:

- Shell syntax and ShellCheck;
- Ruff (code formatting and style);
- Mypy (type safety);
- Local test suites (`tests/test_agents.py` specifically validated for AsyncMock isolation).

## Host findings

- Root filesystem: `/dev/sda1`, approximately 2.2 GiB free.
- Secondary filesystem: `/dev/sdb`, mounted at
  `/mnt/HC_Volume_106574422`, approximately 9.2 GiB free.
- Factory state and logs were still on the root filesystem.
- Rootless Podman worker fails when applying cgroup limits because the service
  has no usable delegated user cgroup.
- The installed doctor did not previously report OpenAI OAuth readiness. The
  current factory code now reports `openai-subscription` readiness based on the
  service user's protected OpenHands OAuth file and provider circuit state.
- Current doctor output showed stalled and quarantined historical jobs. Do not
  delete durable job state without reviewing it.
- Gemini was not passing validation.
- Commit `6e66522c` adds a narrowly scoped fallback for hosts that cannot apply
  nested Podman cgroup limits. The worker retains network, capability, user
  namespace and worktree isolation, and the systemd unit retains aggregate
  service limits.

## Resume sequence

Run these commands on the host. They preserve the existing credentials, but the
credentials previously pasted into chat remain unsafe and should be rotated.

```bash
sudo /home/dev/hellotalk/scripts/migrate-factory-to-secondary-disk.sh
sudo /home/dev/hellotalk/scripts/deploy-and-start-factory.sh \
  --use-existing-credentials
```

The migration script stops the daemon, moves `/var/lib/hellotalk-factory` and
`/var/log/hellotalk-factory` to the secondary filesystem using `rsync`, creates
bind mounts, and backs up `/etc/fstab`. It does not format the disk.

The deployment script installs the latest automation package, repairs canonical
factory paths, runs the online doctor, and starts the daemon and health timer.

After startup, inspect only non-secret operational output:

```bash
sudo systemctl is-active hellotalk-factory.service
sudo journalctl -u hellotalk-factory.service -n 100 --no-pager
sudo -u hellotalk-factory env HOME=/var/lib/hellotalk-factory/home \
  /opt/hellotalk-factory/venv/bin/hellotalk-factory status
```

Do not resume unattended issue processing until these checks pass:

- `openai-subscription`;
- `opencode-go`;
- `github` access through the factory token;
- `worker-terminal`;
- `disk-free`;
- a fresh daemon heartbeat.

Then run one controlled issue-to-PR test before leaving the multi-worker daemon
running overnight. Only merge after GitHub required checks and the factory
review status are both green.

## Important security note

No credentials are stored in this handoff. The OpenCode, GitHub, and Gemini
values previously pasted into chat must be rotated before treating the factory
as trustworthy. ChatGPT OAuth is stored separately under the service user's
`/var/lib/hellotalk-factory/home/.openhands/auth/` directory.
