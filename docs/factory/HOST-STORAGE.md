# Factory host storage

The Factory uses two independently constrained filesystems. Treating them as one
pool hid the real failure modes and allowed a healthy daemon to remain alive
while scheduling was silently blocked by its disk reserve.

| Storage domain | Production path | Main growth sources |
| --- | --- | --- |
| Root filesystem | `/`, including `/home/dev` | provider credentials/history, npm and uv caches, system journal, Docker metadata, legacy checkouts |
| Factory data volume | `/var/lib/hellotalk-factory`, `/var/log/hellotalk-factory` | live worktrees, crash-recovery archives, durable state, logs, rootless Podman graph storage |

## Confirmed incident history

The storage failures were not one bug:

1. On 14 August 2026 the 50 GiB Factory volume reached 100 per cent. The live
   host contained 540 stale worktrees and 207 recovery backups. PR #3573 later
   fixed one worktree-retirement gap for pull requests closed while in post-PR
   states.
2. On 23 August, 70 recovery archives created in four days reduced free space
   below the 5 GiB scheduling reserve. The first fix added a 72-hour age limit.
3. On 26 August, the problem recurred inside that 72-hour window. Regenerable
   build output made individual archives exceed 2 GiB; 19 archives occupied
   about 24 GiB. PR #8092 excluded known build trees and moved cleanup outside
   the storage gate.
4. Root separately reached its reserve because journald, package/browser caches,
   root-owned uv entries, and subscription-provider state accumulated under
   `/home/dev`. Observed provider/tool directories totalled about 6.8 GiB and
   continued growing.
5. Scheduled maintenance cleaned Docker, although the production worker image
   and task containers use rootless Podman. Old Podman layers therefore escaped
   the cleanup path.

The key design error was relying on age-only cleanup and a daily code-update job.
A burst can fill a disk before a time-to-live expires, and maintenance must still
run when `main` has not changed, an update fails, or scheduling is already disk
blocked.

## Steady-state policy

### Recovery archives

`automation/openhands_factory/recovery_retention.py` now applies three limits,
in this order:

1. delete entries older than `FACTORY_RECOVERY_RETENTION_HOURS`;
2. delete the oldest completed archives until aggregate logical size is at or
   below `FACTORY_RECOVERY_MAX_TOTAL_GIB`;
3. when the filesystem is low, delete the oldest completed archives until free
   space reaches `FACTORY_MINIMUM_FREE_DISK_GIB` plus
   `FACTORY_RECOVERY_FREE_HEADROOM_GIB`.

Production defaults are:

```dotenv
FACTORY_MINIMUM_FREE_DISK_GIB=5
FACTORY_RECOVERY_RETENTION_HOURS=72
FACTORY_RECOVERY_MAX_TOTAL_GIB=2
FACTORY_RECOVERY_FREE_HEADROOM_GIB=1
```

`RECOVERY.txt` is written as the final archive step and is treated as the
completion marker. Pressure cleanup also gives new archives a ten-minute grace
period, so it cannot race a copy still in progress. Normally one archive is
retained. That floor is removed when the archive budget is already exceeded or
free space is below the scheduling reserve, preventing one oversized archive
from permanently blocking the Factory.

Deletion errors are logged and are not reported as successful removals. Size
walking uses `lstat()` and never follows symlinks outside the archive.

### Live worktrees

The scheduler remains authoritative for worktree lifecycle. Merged jobs remove
their worktree before entering `DONE`; inactive non-terminal jobs are retired by
refresh; discovered jobs replace stale worktrees after archiving dirty changes.
`QUARANTINED` is a bounded 30-minute cooldown, not permanent storage: recovery
returns the job to discovery, where stale worktree retirement runs.

Never bulk-delete active worktrees merely to recover space. Use durable job and
heartbeat state to establish ownership first.

### Host maintenance

`maintain-factory-host-storage.sh` is safe to run repeatedly. It now:

- takes a host-wide non-blocking lock;
- installs and restarts journald only when its policy changed;
- keeps archived journals within 512 MiB and 14 days;
- prunes unused uv cache records as `dev`, avoiding root-owned cache creation;
- skips an absent or unavailable Docker daemon without aborting the whole pass;
- prunes Docker dangling images and bounded builder cache when Docker exists;
- prunes the **rootless Podman** image/build-cache store used by the Factory;
- reports root, Factory-state, container-engine, and provider-home storage in
  read-only mode.

It deliberately never invokes `docker system prune` or `podman system prune` and
never removes volumes, named images, stopped/running containers, provider
credentials, or provider history databases.

Inspect without changing the host:

```bash
sudo scripts/maintain-factory-host-storage.sh
```

Apply bounded maintenance:

```bash
sudo scripts/maintain-factory-host-storage.sh --apply --prune-containers
```

`--prune-docker` remains a compatibility alias for older deployment scripts, but
it now covers both container engines. Docker and Podman dangling images are
limited to objects older than seven days by default.

The existing two-minute health watchdog invokes this command at most hourly,
independently of the daily update service:

```dotenv
FACTORY_STORAGE_MAINTENANCE_INTERVAL_SECONDS=3600
FACTORY_STORAGE_MAINTENANCE_TIMEOUT_SECONDS=75
```

It skips the pass while `hellotalk-factory-update.service` is active, preventing
cleanup from overlapping a worker-image build. Maintenance failure is logged but
does not turn a healthy daemon into a restart loop.

### Provider state and caches

Provider authentication and history are durable writable mounts by design. They
must not be deleted as if they were generic caches. The structural fix is to
move their normal paths off the non-resizable root filesystem.

The relocation command uses the pre-staged **dedicated provider-state volume**
`HC_Volume_106720613` at `/mnt/HC_Volume_106720613`:

```bash
sudo scripts/relocate-home-cache-to-second-disk.sh
sudo scripts/relocate-home-cache-to-second-disk.sh --apply
```

It migrates `.cache`, `.local`, `.gemini`, `.pi`, `.codex`, `.claude`, `.npm`,
`.npm-global`, `.opencode`, and `.config`. The service is stopped only when it
was running, each copy is verified with an rsync checksum dry run, bind mounts
are persisted in `/etc/fstab`, ownership is restored, and the service returns to
its prior running/stopped state. Credentials and histories are moved intact.

Attach `HC_Volume_106720613` before `--apply`; the script reports a clear error
without modifying the host while it is absent. A custom disk is supported by
setting both `RELOCATE_CACHE_MOUNT_POINT` and `RELOCATE_CACHE_DEVICE_BY_ID`. An
unformatted configured device is formatted only during `--apply`; an already
mounted volume is never reformatted.

Do not point this at `/mnt/HC_Volume_106574422`, which backs Factory state and
rootless Podman. Provider-native histories have no safe generic retention API;
placing them there would move, rather than remove, the unbounded pressure that
can block scheduling. The dedicated volume isolates that failure domain and can
be expanded without growing the boot filesystem.

## Diagnosis

Start with filesystem truth, then attribute space within each device:

```bash
df -h / /var/lib/hellotalk-factory
sudo du -xhd1 /
sudo du -xhd1 /home/dev
sudo du -xhd1 /var/lib/hellotalk-factory
sudo journalctl --disk-usage
sudo scripts/maintain-factory-host-storage.sh
```

Use both `df` and `du`. Open-but-deleted files, ext4 reserved blocks, mount
boundaries, and root-only paths can make their totals differ. For deleted files
still held open:

```bash
sudo lsof +L1
```

For Factory-state pressure, inspect:

```bash
sudo du -sh /var/lib/hellotalk-factory/worktrees \
  /var/lib/hellotalk-factory/recovery \
  /var/lib/hellotalk-factory/repository \
  /var/log/hellotalk-factory
sudo git -C /var/lib/hellotalk-factory/repository worktree list --porcelain
```

Do not remove a worktree listed by an active job. Do not delete `jobs.json`,
provider health/provenance state, or the canonical repository.

## Root recovery sequence

1. Pause new scheduling without deleting durable jobs.
2. Capture `df`, `du`, journal usage, `lsof +L1`, Docker usage, and rootless
   Podman usage.
3. Run bounded host maintenance.
4. Confirm recovery archives are being pruned by age, aggregate size, or disk
   pressure as appropriate.
5. Relocate provider/tool state if it still lives on root.
6. Run `hellotalk-factory doctor --online`, inspect the durable `storage_blocked`
   field, and perform one control-panel sync.
7. Resume scheduling only after root and Factory-state reserves are both green.

## Remaining limits

The Factory intentionally preserves dirty work before retiring a worktree.
Archive exclusions and the aggregate cap prevent long-term accumulation, but a
single archive can transiently grow while its copy is in progress; incomplete
archives are not deleted underneath the writer. The 5 GiB reserve, known build
artifact exclusions, three-job concurrency limit, and immediate post-completion
pressure sweep bound this risk. A future patch-format recovery archive could
reduce that transient further, but it must first prove equivalent restoration
of binary changes and untracked files.

Provider-native databases may continue to grow after relocation. That consumes
the expandable secondary volume rather than root, but it is still monitored and
must be expanded or given provider-specific retention if its documented format
supports safe compaction. Opaque credential/history data is never automatically
trimmed.
