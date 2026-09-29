# Repository Factory migration

`repo-factory` is the repository-neutral control plane name. The legacy
`hellotalk-factory` CLI, service files and state paths remain available during
the compatibility window. No state is deleted by this migration.

## Instance layout

| Instance | Repository | State | Admission |
| --- | --- | --- | --- |
| `hellotalk` | `elgansayer/elgl` | Existing `/var/lib/hellotalk-factory` state | Existing policy |
| `workout-agent` | `elgansayer/workout-agent` | `/var/lib/repo-factory/workout-agent` | One new labelled issue per hour |

`/var/lib/repo-factory` and `/var/log/repo-factory` resolve to the second disk.
Both instances share `/var/lib/repo-factory/shared/provider-capacity.json`, so
subscription limits apply across the host rather than independently per daemon.
The `repo-factory.slice` cgroup applies a combined 7 GiB hard memory ceiling.
The compatibility paths under `/opt/hellotalk-factory` remain only to avoid a
risky in-place virtual-environment move; operator-facing commands, units and new
state paths use `repo-factory`.

## Install without activation

```bash
sudo scripts/install-repo-factory-instance.sh --instance workout-agent
```

The installer creates a fresh dedicated runtime checkout and does not modify the
existing operator clone on the second disk. Activate only after Workout Agent's
`CI / required` workflow and the `factory/independent-review` ruleset are present.
The legacy daily updater learns to coordinate the Workout Agent service even
before the HelloTalk unit is renamed.

## Migrate HelloTalk naming

```bash
sudo scripts/install-repo-factory-instance.sh \
  --instance hellotalk \
  --migrate-hellotalk \
  --activate
```

The new instance reads the existing HelloTalk state and worktrees in place. The
legacy unit files remain installed but disabled. The neutral update timer then
waits for both repositories to become idle, fast-forwards the shared control
checkout, refreshes the package and worker image, and restores both previously
active services if an update fails.

## Dashboard

`factory-dashboard` serves both repositories from the existing
`factory.elgansayer.com` deployment. Its container mounts each state directory
read-only and exposes project-scoped API routes. Rebuild it after migration:

```bash
cd factory-dashboard
./start.sh
```

## Rollback

```bash
sudo systemctl disable --now repo-factory-health@hellotalk.timer
sudo systemctl disable --now repo-factory@hellotalk.service
sudo systemctl disable --now repo-factory-update.timer
sudo systemctl enable --now hellotalk-factory.service
sudo systemctl enable --now hellotalk-factory-health.timer
sudo systemctl enable --now hellotalk-factory-update.timer
```

Rollback does not require copying or transforming state. Do not activate both
HelloTalk units simultaneously because they intentionally share one generation
lock and one job store.
