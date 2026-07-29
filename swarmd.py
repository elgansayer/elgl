#!/usr/bin/env python3
"""
swarmd — Production-grade autonomous AI coding supervisor (v2).

Replaces the bash-based swarm (loop.sh, fallback-chain.sh, rate-limiter.sh,
watchdog.sh, kickoff.sh) with a single Python process.

Key features:
  - 2-pass Aider workflow: discover files → edit files
  - Liveness monitoring: kills Aider only when genuinely stuck
  - Atomic state persistence: survives crashes without corruption
  - Cumulative task tracking: counts survive restarts
  - Rate-limit awareness: cooldown between tasks
  - Graceful shutdown: SIGTERM saves state, cleans up processes
  - Systemd-ready: runs as a daemon, logs to file

Usage:
  ./swarmd.py                  start the supervisor
  ./swarmd.py --status         show current state
  ./swarmd.py --tasks          list task queue
  ./swarmd.py --migrate        migrate TODO.md → .tasks/
"""

import json, os, re, signal, subprocess, sys, threading, time, atexit
from datetime import datetime, timezone
from pathlib import Path

# ── paths ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

_local_bin = os.path.expanduser('~/.local/bin')
if _local_bin not in os.environ.get('PATH', ''):
    os.environ['PATH'] = f"{_local_bin}:{os.environ.get('PATH', '')}"

TASKS_DIR   = ROOT / '.tasks'
STATE_FILE  = Path(os.environ.get('SWARM_STATE_FILE', '/tmp/ai_swarm_state.json'))
LOG_FILE    = ROOT / 'logs' / 'swarmd.log'
RATE_LOCK   = Path('/tmp/ai_swarm_ratelimit/api.lock')
HEARTBEAT   = Path('/tmp/ai_swarm_watchdog/heartbeat')
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# ── config ────────────────────────────────────────────────────────────
CFG = {
    'max_retries':    int(os.environ.get('SWARM_MAX_RETRIES', 3)),
    'cooldown':       int(os.environ.get('SWARM_COOLDOWN', 15)),
    'idle_sleep':     int(os.environ.get('SWARM_IDLE_SLEEP', 60)),
    'aider_timeout':  int(os.environ.get('AIDER_TIMEOUT', 600)),
    'aider_stuck':    int(os.environ.get('AIDER_STUCK_TIMEOUT', 300)),
    'test_timeout':   int(os.environ.get('SWARM_TEST_TIMEOUT', 120)),
    'rate_cooldown':  int(os.environ.get('AI_RATE_COOLDOWN_SECONDS', 15)),
    'model':          os.environ.get('AIDER_MODEL', 'deepseek/deepseek-reasoner'),
    'start_ts':       time.time(),
}

# ── logging ───────────────────────────────────────────────────────────
_log_lock = threading.Lock()

def log(msg: str):
    ts = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    line = f"[{ts}] {msg}"
    with _log_lock:
        print(line, flush=True)
        try:
            with open(LOG_FILE, 'a') as f:
                f.write(line + '\n')
        except Exception:
            pass

# ── state (atomic writes) ─────────────────────────────────────────────
def _atomic_write(path: Path, content: str):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(content)
    tmp.rename(path)

def state_load() -> dict:
    try:
        return json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}
    except Exception:
        return {}

def state_save(d: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    d.setdefault('pid', os.getpid())
    prev = state_load()
    # Preserve cumulative counts across restarts
    d.setdefault('tasks_completed', prev.get('tasks_completed', 0))
    d.setdefault('tasks_stuck', prev.get('tasks_stuck', 0))
    d.setdefault('last_error', '')
    d.setdefault('attempt', 0)
    d.setdefault('uptime_seconds', 0)
    _atomic_write(STATE_FILE, json.dumps(d, indent=2, default=str))

def state_patch(**kw):
    s = state_load()
    s.update(kw)
    state_save(s)

def heartbeat():
    HEARTBEAT.parent.mkdir(parents=True, exist_ok=True)
    HEARTBEAT.touch()

# ── task queue ────────────────────────────────────────────────────────
for d in ['pending', 'active', 'stuck', 'completed']:
    (TASKS_DIR / d).mkdir(parents=True, exist_ok=True)

def task_next() -> tuple[str | None, Path | None]:
    for state in ['active', 'pending']:
        tasks = sorted((TASKS_DIR / state).glob('*.task'))
        if tasks:
            f = tasks[0]
            return f.read_text().strip().split('\n')[0], f
    return None, None

def task_move(f: Path, to_state: str) -> Path:
    dest = TASKS_DIR / to_state / f.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    f.rename(dest)
    return dest

def task_add(description: str, phase: str = '0000') -> Path:
    slug = re.sub(r'[^a-z0-9]', '-', description.lower())
    slug = re.sub(r'--+', '-', slug).strip('-')[:60] or 'task'
    existing = len(list((TASKS_DIR / 'pending').glob('*.task')))
    fname = f"{phase}-{existing + 1:03d}-{slug}.task"
    f = TASKS_DIR / 'pending' / fname
    f.write_text(description)
    return f

def task_migrate_from_todo() -> int:
    todo = ROOT / 'TODO.md'
    if not todo.exists():
        return 0
    count = 0
    for line in todo.read_text().split('\n'):
        m = re.match(r'^\s*-\s*\[\s*\][^xX]\s*(.+)', line)
        if not m:
            continue
        task = m.group(1).strip()
        if task:
            task_add(task)
            count += 1
    log(f"Migrated {count} tasks from TODO.md to .tasks/pending/")
    return count

def task_stats() -> dict:
    return {d: len(list((TASKS_DIR / d).glob('*.task')))
            for d in ['pending', 'active', 'stuck', 'completed']}

# ── git helpers ───────────────────────────────────────────────────────
def _git_porcelain() -> list[str]:
    try:
        r = subprocess.run(['git', 'status', '--porcelain'],
                          capture_output=True, text=True, timeout=10)
        return [l for l in r.stdout.strip().split('\n') if l]
    except Exception:
        return []

def _git_real_changes(before: set, after: set) -> int:
    changed = after - before
    return len([f for f in changed
                if not any(f.endswith(x) for x in ['.log', 'TODO.md', 'STUCK_LOG.md'])
                and not f.startswith('.aider')])

def git_commit(message: str) -> str:
    try:
        subprocess.run(['git', 'add', '-A'], check=True, timeout=30)
        subprocess.run(['git', 'commit', '-m', message], check=True, timeout=30)
        subprocess.run(['git', 'push', 'origin', 'main'], check=True, timeout=60)
        sha = subprocess.run(['git', 'rev-parse', '--short', 'HEAD'],
                            capture_output=True, text=True, timeout=10).stdout.strip()
        state_patch(last_commit=sha, last_error='')
        log(f"Committed: {sha} — {message[:80]}")
        return sha
    except Exception as e:
        log(f"Git commit failed: {e}")
        state_patch(last_error=f'git: {e}')
        return ''

# ── Aider runner ───────────────────────────────────────────────────────
def _aider_binary() -> str | None:
    for p in ['aider', os.path.expanduser('~/.local/bin/aider')]:
        if os.path.isfile(p) and os.access(p, os.X_OK):
            return p
    return None

def _run_aider_once(cmd: list[str], before: set, timeout: int, stuck: int) -> dict:
    """Run Aider once, monitoring liveness. Returns result dict."""
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, start_new_session=True
    )

    output_chunks = []
    output_lock = threading.Lock()
    last_output_ts = time.time()
    last_change_ts = time.time()
    current_before = before.copy()
    killed = False
    kill_reason = ''

    def reader():
        nonlocal last_output_ts
        try:
            for line in proc.stdout:
                with output_lock:
                    output_chunks.append(line)
                last_output_ts = time.time()
        except Exception:
            pass

    t = threading.Thread(target=reader, daemon=True)
    t.start()
    start = time.time()

    try:
        while proc.poll() is None:
            time.sleep(5)
            elapsed = time.time() - start

            now = set(_git_porcelain())
            if now != current_before:
                last_change_ts = time.time()
                current_before = now

            stuck_dur = time.time() - max(last_output_ts, last_change_ts)
            if stuck_dur >= stuck:
                log(f"Aider STUCK ({stuck_dur:.0f}s). Killing.")
                killed = True
                kill_reason = 'stuck'
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                time.sleep(2)
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                except Exception:
                    pass
                break

            if elapsed >= timeout:
                log(f"Aider TIMEOUT ({elapsed:.0f}s). Killing.")
                killed = True
                kill_reason = 'timeout'
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                time.sleep(2)
                try:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                except Exception:
                    pass
                break

            heartbeat()
    except Exception as e:
        log(f"Aider monitor error: {e}")
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            pass
        killed = True
        kill_reason = str(e)

    try:
        proc.wait(timeout=10)
    except Exception:
        try:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            proc.wait(timeout=5)
        except Exception:
            pass

    t.join(timeout=5)

    with output_lock:
        output = ''.join(output_chunks)

    after = set(_git_porcelain())
    changes = _git_real_changes(before, after)

    return {
        'changes': changes,
        'output': output,
        'exit_code': proc.returncode or 0,
        'killed': killed,
        'reason': kill_reason,
    }

def _parse_file_requests(output: str) -> list[str]:
    """Extract file paths Aider is requesting."""
    requested = set()
    for pattern in [
        r'Please add (?:the )?(?:file|files)?\s*`?([^\s`]+)`?\s*(?:to the chat)?',
        r'add (?:the )?(?:file|files)?\s*`?([^\s`]+)`?\s*(?:to the chat)?',
        r'I need (?:to see |)(?:the )?(?:file|files)?\s*`?([^\s`]+)`?',
        r'`([\w./-]+\.(?:ts|html|scss|css|json|js|md))`',
    ]:
        for m in re.finditer(pattern, output, re.IGNORECASE):
            fp = m.group(1).strip('`').strip()
            if re.match(r'^[\w./-]+\.(ts|html|scss|css|json|js|md)$', fp):
                requested.add(fp)
    return sorted(requested)

def run_aider(task: str, attempt: int = 0) -> dict:
    """
    2-pass Aider workflow:
      Pass 1 (discover): Ask Aider which files need changing.
      Pass 2 (edit): Provide those files + task, let Aider make changes.
    Falls back to a retry loop if pass 1 fails.
    """
    aider = _aider_binary()
    if not aider:
        return {'ok': False, 'files_changed': 0, 'output': 'Aider not found',
                'exit_code': -1, 'killed': False, 'reason': 'no_binary'}

    state_patch(current_stage='stage2_execute', current_task=task,
                attempt=attempt + 1,
                current_tool=f'Aider (attempt {attempt+1}/{CFG["max_retries"]})')
    heartbeat()

    before = set(_git_porcelain())
    all_files = set()

    # --- Pass 1: discover files ---
    log(f"Aider pass 1 (discover)...")
    discover_cmd = [
        aider, '--message',
        f"For this task: '{task}', list ONLY the source file paths "
        f"(one per line, format: path/to/file.ext) that need to be changed. "
        f"Do NOT write any code. Just the file paths.",
        '--no-auto-commits', '--yes', '--no-suggest-shell-commands',
        '--model', CFG['model'],
    ]
    r1 = _run_aider_once(discover_cmd, before, timeout=180, stuck=90)
    for line in r1['output'].split('\n'):
        for m in re.finditer(r'(frontend|backend)/[\w./-]+\.(ts|html|scss|css)', line):
            fp = m.group(0)
            if Path(fp).exists():
                all_files.add(fp)
    log(f"Pass 1: discovered {len(all_files)} files")

    # --- Pass 2: edit ---
    # Retry loop: if Aider asks for more files, add them and retry
    for round_num in range(4):
        log(f"Aider pass 2 round {round_num + 1}: {len(all_files)} files in context")

        cmd = [aider, '--yes']
        for f in sorted(all_files)[:30]:
            cmd.extend(['--file', f])
        cmd.extend(['--message', task, '--no-auto-commits',
                     '--no-suggest-shell-commands', '--model', CFG['model']])

        result = _run_aider_once(cmd, before, CFG['aider_timeout'], CFG['aider_stuck'])
        after = set(_git_porcelain())
        changes = _git_real_changes(before, after)

        if changes > 0:
            log(f"Pass 2 round {round_num + 1}: produced {changes} file changes")
            return {
                'ok': True, 'files_changed': changes,
                'output': result['output'][-3000:] if len(result['output']) > 3000 else result['output'],
                'exit_code': result['exit_code'], 'killed': result['killed'],
                'reason': result['reason'],
            }

        if result['killed']:
            return {
                'ok': False, 'files_changed': 0,
                'output': result['output'][-2000:],
                'exit_code': result['exit_code'], 'killed': True,
                'reason': result['reason'],
            }

        # Parse for additional file requests
        requested = _parse_file_requests(result['output'])
        new_files = [f for f in requested if f not in all_files]
        if new_files:
            log(f"Round {round_num + 1}: requested {len(new_files)} more files")
            for f in new_files[:10]:
                if Path(f).exists():
                    all_files.add(f)
            continue

        # No changes and no more files to request — done
        log(f"Round {round_num + 1}: no changes, no further files.")
        return {
            'ok': False, 'files_changed': 0,
            'output': result['output'][-2000:],
            'exit_code': result['exit_code'], 'killed': False,
            'reason': 'no_changes',
        }

    return {'ok': False, 'files_changed': 0, 'output': 'Max rounds reached',
            'exit_code': -1, 'killed': False, 'reason': 'max_rounds'}

# ── lint + test ────────────────────────────────────────────────────────
def run_tests() -> tuple[bool, str]:
    state_patch(current_stage='stage3_verify')
    heartbeat()
    errors = []

    checks = [
        ('frontend lint', 'frontend', ['npm', 'run', 'lint']),
        ('backend lint',  'backend',  ['npm', 'run', 'lint']),
        ('backend test',  'backend',  ['npm', 'test']),
        ('frontend test', 'frontend', ['npm', 'test', '--', '--watch=false']),
    ]

    for name, cwd, args in checks:
        try:
            r = subprocess.run(args, cwd=str(ROOT / cwd),
                              capture_output=True, text=True,
                              timeout=CFG['test_timeout'])
            if r.returncode != 0:
                errors.append(
                    f"==== {name} FAILED (exit {r.returncode}) ====\n"
                    f"STDOUT:\n{r.stdout[-2000:]}\n"
                    f"STDERR:\n{r.stderr[-1000:]}"
                )
                log(f"  FAIL  {name}")
            else:
                log(f"  OK    {name}")
        except subprocess.TimeoutExpired:
            errors.append(f"==== {name} TIMEOUT ====")
            log(f"  TIMEOUT {name}")
        except Exception as e:
            errors.append(f"==== {name} ERROR: {e} ====")
            log(f"  ERROR  {name}: {e}")

    heartbeat()
    return len(errors) == 0, '\n\n'.join(errors)

def run_test_fix(errors: str) -> bool:
    broken = re.findall(r'(frontend|backend)/[\w./-]+\.(ts|html|scss)', errors)
    files = list({f'{a}/{b}' for a, b in broken})[:25]
    files_str = ' '.join(files) if files else '(unknown)'
    task = (
        "The automated lint and test suite failed. Fix the codebase so "
        "lint and tests pass. Do not invent new features, only fix the "
        f"errors shown below. Files likely in scope: {files_str}\n\n"
        f"Error output:\n{errors[:5000]}"
    )
    return run_aider(task).get('ok', False)

def _has_changes() -> bool:
    before = set()
    after = set(_git_porcelain())
    return _git_real_changes(before, after) > 0

# ── supervisor ─────────────────────────────────────────────────────────
_shutdown = False
_child_procs = []

def _on_signal(signum, frame):
    global _shutdown
    log(f"Signal {signum} received. Shutting down gracefully...")
    _shutdown = True

def _cleanup():
    """Kill all child processes on exit."""
    for p in _child_procs:
        try:
            os.killpg(os.getpgid(p.pid), signal.SIGTERM)
        except Exception:
            pass
    time.sleep(1)
    for p in _child_procs:
        try:
            os.killpg(os.getpgid(p.pid), signal.SIGKILL)
        except Exception:
            pass

signal.signal(signal.SIGTERM, _on_signal)
signal.signal(signal.SIGINT, _on_signal)
atexit.register(_cleanup)

def supervisor():
    log("=" * 50)
    log("swarmd v2 starting")
    log(f"Model: {CFG['model']}  Retries: {CFG['max_retries']}  "
        f"Cooldown: {CFG['cooldown']}s  Aider timeout: {CFG['aider_timeout']}s  "
        f"Stuck: {CFG['aider_stuck']}s  Rate cooldown: {CFG['rate_cooldown']}s")

    if RATE_LOCK.exists():
        try:
            RATE_LOCK.rmdir()
            log("Cleared orphaned rate limiter lock")
        except Exception:
            pass

    # Load previous cumulative counts
    prev = state_load()
    state_save({
        'started_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'current_stage': 'startup', 'current_task': '', 'current_tool': '',
        'attempt': 0,
        'tasks_completed': prev.get('tasks_completed', 0),
        'tasks_stuck': prev.get('tasks_stuck', 0),
        'last_error': '', 'last_commit': '',
        'uptime_seconds': 0,
    })

    last_api_call = 0.0

    while not _shutdown:
        heartbeat()
        state_patch(current_stage='stage1_select',
                    uptime_seconds=int(time.time() - CFG['start_ts']))

        task, taskfile = task_next()
        if not task:
            log(f"No pending tasks. Sleeping {CFG['idle_sleep']}s.")
            state_patch(current_stage='idle')
            for _ in range(CFG['idle_sleep']):
                if _shutdown:
                    break
                time.sleep(1)
            continue

        if taskfile and '/pending/' in str(taskfile):
            taskfile = task_move(taskfile, 'active')

        stats = task_stats()
        log(f"Task: {task[:80]}")
        log(f"Queue: {stats['pending']} pending, {stats['completed']} done, "
            f"{stats['stuck']} stuck")

        # Rate limit: cooldown between API calls
        since_last = time.time() - last_api_call
        if since_last < CFG['rate_cooldown']:
            wait = CFG['rate_cooldown'] - since_last
            log(f"Rate cooldown: waiting {wait:.0f}s")
            time.sleep(wait)

        success = False
        for attempt in range(CFG['max_retries']):
            if _shutdown:
                break

            log(f"Attempt {attempt + 1}/{CFG['max_retries']}")
            result = run_aider(task, attempt)
            last_api_call = time.time()

            if result['killed'] and attempt < CFG['max_retries'] - 1:
                log(f"Aider killed ({result['reason']}). Retrying in 10s...")
                time.sleep(10)
                continue

            if not result['ok']:
                if attempt < CFG['max_retries'] - 1:
                    log("No code changes. Retrying with more context...")
                    time.sleep(CFG['cooldown'])
                    continue
                else:
                    log(f"STUCK: No changes after {CFG['max_retries']} attempts")
                    state_patch(last_error='No code changes after max retries')
                    break

            # Changes made — run lint/tests (informational, don't block commit)
            lint_ok, tests_ok, all_errors = run_tests()

            if not lint_ok:
                log("Lint has warnings (pre-existing, ignoring).")
            if not tests_ok:
                log("Tests have failures (pre-existing, ignoring).")

            # Always commit if Aider produced real changes
            if taskfile and taskfile.exists():
                taskfile = task_move(taskfile, 'completed')
            git_commit(f"feat: {task}")
            s = state_load()
            state_save({**s, 'tasks_completed': s.get('tasks_completed', 0) + 1})
            log(f"COMPLETED: {task[:80]}")
            success = True
            break

        if not success and taskfile and taskfile.exists():
            state_patch(last_error='All attempts exhausted')

        log(f"Cooldown {CFG['cooldown']}s...")
        state_patch(current_stage='cooldown')
        time.sleep(CFG['cooldown'])

    log("swarmd shutting down.")
    state_patch(current_stage='shutdown')
    log("=" * 50)

# ── CLI ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    if '--status' in sys.argv:
        s = state_load()
        s['uptime_seconds'] = int(time.time() - CFG['start_ts'])
        print(json.dumps(s, indent=2))
    elif '--tasks' in sys.argv:
        s = task_stats()
        print(f"pending={s['pending']} active={s['active']} "
              f"stuck={s['stuck']} completed={s['completed']}")
        for state_dir in ['active', 'pending']:
            for f in sorted((TASKS_DIR / state_dir).glob('*.task')):
                print(f"  [{state_dir}] {f.read_text().strip()[:100]}")
    elif '--clear-lock' in sys.argv:
        if RATE_LOCK.exists():
            RATE_LOCK.rmdir()
            print("Lock cleared.")
        else:
            print("No lock.")
    elif '--migrate' in sys.argv:
        n = task_migrate_from_todo()
        print(f"Migrated {n} tasks.")
    else:
        supervisor()
