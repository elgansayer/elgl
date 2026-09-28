# Factory host storage

## Current host finding

The 17 August 2026 investigation found two distinct storage domains:

- `/dev/sda1` is the 38 GiB root filesystem. It reached 100 per cent utilisation.
- `/dev/sdb` is the 50 GiB secondary volume mounted at `/mnt/HC_Volume_106574422`.
  Factory state and logs are already bind-mounted from this volume.

The largest confirmed root consumers were:

- 3.6 GiB of persistent system journal data;
- 3.1 GiB of developer OpenCode history;
- 2.6 GiB of reproducible npm, uv, Cypress, and Playwright caches;
- 547 MiB in an inactive developer-owned Factory tree;
- Docker data beneath root-owned `/var/lib/docker`, whose exact size requires root access;
- normal source checkouts, dependency trees, agent installations, and a 4 GiB swap file.

`du` run as an unprivileged user cannot account for root-only Docker and journal paths. Ext4 reserved blocks also
make `df` available space lower than the raw free-block count. Use both `sudo du -xhd1 /` and `df -h /` when
reconciling usage.

During the investigation, only reproducible caches were deleted. OpenCode history was copied and verified before
its standard data path was switched to the secondary volume. The inactive Factory tree was copied and verified
before its root copy was removed. At 12:13 UTC, root had recovered from zero available space to 3.6 GiB available.

The preserved host paths are:

```text
/home/dev/.local/share/opencode
  -> /mnt/HC_Volume_106574422/actions-runner/dev-data/opencode

/mnt/HC_Volume_106574422/actions-runner/dev-data/archives/
  hellotalk-factory-legacy-20260809
```

These are developer-user paths. The daemon now runs as that same operator user (`dev`) and reads provider
credentials directly from `/home/dev`, so there is no separate service home to keep in sync with it.

## Bounded retention policy

The repository policy at `config/systemd/99-hellotalk-factory-storage.conf` limits persistent journals to 512 MiB,
keeps at least 5 GiB free where possible, and removes entries older than 14 days. Production deployment installs
the policy and performs one journal rotation and vacuum before refreshing dependencies.

Inspect without changing the host:

```bash
sudo scripts/maintain-factory-host-storage.sh
```

Install the policy and vacuum archived journals:

```bash
sudo scripts/maintain-factory-host-storage.sh --apply
```

Optionally remove only dangling Docker images older than seven days and unused build cache above 2 GB:

```bash
sudo scripts/maintain-factory-host-storage.sh --apply --prune-docker
```

The maintenance command never removes Docker volumes, named images, or containers. It deliberately does not use
`docker system prune`. Docker pruning is not automatic during Factory deployment because the host Docker daemon
may serve workloads outside the Factory.

To roll back the journal policy:

```bash
sudo rm /etc/systemd/journald.conf.d/99-hellotalk-factory-storage.conf
sudo systemctl restart systemd-journald.service
```

Removing the policy does not restore already vacuumed journal entries.

## Control-panel storage health

The GitHub control panel reports root and Factory-state volume usage separately. Each row includes used
percentage, free GiB, the configured reserve, state, and a projected exhaustion timestamp when a meaningful
short-term decline is observed.

The states are:

- `healthy`: at least twice the configured reserve is free;
- `warning`: between one and two reserves are free;
- `critical`: less than the configured reserve is free;
- `unavailable`: the volume could not be measured.

`FACTORY_MINIMUM_FREE_DISK_GIB` is 5 GiB in production. A warning, critical, or unavailable volume prevents a
green top-level indicator. Projection starts only after at least 64 MiB is consumed over at least one minute.
It is a short-term trend estimate, not a quota promise, and can change after builds, cache cleanup, or log
rotation.

The daemon checks both reserves before each scheduling cycle. Falling below either reserve stops new task and
architect work without terminating active workers, consuming task attempts, quarantining jobs, or stopping the
daemon. Scheduling resumes automatically after both reserves recover. The durable daemon snapshot exposes
`storage_blocked` so restart and panel diagnostics remain explicit.

## Root recovery sequence

When root is full, use this order:

1. Pause new Factory scheduling, but do not delete jobs or worktrees.
2. Record `df -h`, `sudo journalctl --disk-usage`, `sudo docker system df -v`, and `sudo du -xhd1 /`.
3. Clear reproducible package and browser caches with their native commands.
4. Apply the bounded journal policy.
5. Run the optional bounded Docker prune only after confirming the Docker daemon is not performing a build.
6. Move durable histories only through copy, byte-for-byte verification, path switch, smoke test, then contraction.
7. Run `doctor --online`, provider health checks, and one harmless control-panel sync before resuming work.

Do not delete `/var/lib/docker`, provider databases, credential directories, Factory `jobs.json`, worktrees, or
runner installations to create emergency space.

If Docker remains the dominant root consumer after bounded pruning, schedule a maintenance window to migrate its
data root to the secondary volume. Stop Docker, make a resumable `rsync -aHAX` copy, validate the copy, switch via
an explicit Docker `data-root` or bind mount, start Docker, and verify every required workload before deleting the
old tree. Keep a rollback copy until that verification passes. This migration is intentionally not performed by
normal Factory deployment.

## Secondary-volume failure

The OpenCode developer path is a symlink. If the secondary volume is unavailable, do not run OpenCode against a
dangling or partially mounted path. Restore it only after stopping OpenCode and confirming root has room for the
full database:

```bash
rsync -aH /mnt/HC_Volume_106574422/actions-runner/dev-data/opencode/ \
  /home/dev/.local/share/opencode.restore/
rsync -aHnci --delete /mnt/HC_Volume_106574422/actions-runner/dev-data/opencode/ \
  /home/dev/.local/share/opencode.restore/
unlink /home/dev/.local/share/opencode
mv /home/dev/.local/share/opencode.restore /home/dev/.local/share/opencode
```

After restoration, run `opencode auth list` and a read-only database count before deleting the secondary copy.
The Factory service-home bind mounts have their own recovery procedure in
`scripts/migrate-factory-to-secondary-disk.sh`; do not replace those mounts with developer-user symlinks.
