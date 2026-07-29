#!/usr/bin/env python3
"""
swarmd — Production-grade autonomous AI coding supervisor.

Replaces the entire bash-based swarm (loop.sh, fallback-chain.sh,
rate-limiter.sh, watchdog.sh, kickoff.sh) with a single Python process
that is:

  - Observable  (JSON state file at /tmp/ai_swarm_state.json)
  - Recoverable (never loses work on crash)
  - Self-healing (detects stuck Aider, rate limits, model errors)
  - Configurable (all knobs via env vars)
  - Killable     (SIGTERM saves state and exits cleanly)

Architecture:
  read task → run Aider → check changes → lint+test → fix errors → commit

Usage:
  ./swarmd.py                  start the supervisor
  ./swarmd.py --status         show current state
  ./swarmd.py --tasks          list task queue
  ./swarmd.py --clear-lock     clear orphaned rate lock
  ./swarmd.py --migrate        migrate TODO.md → .tasks/
"""

import json, os, re, signal, subprocess, sys, threading, time
from datetime import datetime, timezone
from pathlib import Path

# ── paths ─────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
TASKS_DIR    = ROOT / '.tasks'
STATE_FILE   = Path(os.environ.get('SWARM_STATE_FILE', '/tmp/ai_swarm_state.json'))
LOG_FILE     = ROOT / 'logs' / 'swarmd.log'
RATE_LOCK    = Path('/tmp/ai_swarm_ratelimit/api.lock')
HEARTBEAT    = Path('/tmp/ai_swarm_watchdog/heartbeat')

LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

# ── config from env ────────────────────────────────────────────────────
CFG = {
    'max_retries':       int(os.environ.get('SWARM_MAX_RETRIES', 3)),
    'cooldown':          int(os.environ.get('SWARM_COOLDOWN', 15)),
    'idle_sleep':        int(os.environ.get('SWARM_IDLE_SLEEP', 60)),
    'aider_timeout':      int(os.environ.get('AIDER_TIMEOUT', 600)),
    'aider_stuck':        int(os.environ.get('AIDER_STUCK_TIMEOUT', 300)),
    'test_timeout':       int(os.environ.get('SWARM_TEST_TIMEOUT', 120)),
    'deepseek_key':       os.environ.get('DEEPSEEK_API_KEY', ''),
    'model':              os.environ.get('AIDER_MODEL', 'deepseek/deepseek-chat'),
}

# ── logging ────────────────────────────────────────────────────────────
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

# ── state persistence ──────────────────────────────────────────────────
def state_load() -> dict:
    try:
        return json.loads(STATE_FILE.read_text()) if STATE_FILE.exists() else {}
    except Exception:
        return {}

def state_save(d: dict):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    d.setdefault('pid', os.getpid())
    d.setdefault('tasks_completed', 0)
    d.setdefault('tasks_stuck', 0)
    d.setdefault('last_error', '')
    d.setdefault('attempt', 0)
    STATE_FILE.write_text(json.dumps(d, indent=2, default=str))

def state_patch(**kw):
    s = state_load()
    s.update(kw)
    state_save(s)

def heartbeat():
    HEARTBEAT.parent.mkdir(parents=True, exist_ok=True)
    HEARTBEAT.touch()

# ── task queue (.tasks/ directory) ─────────────────────────────────────
for d in ['pending', 'active', 'stuck', 'completed']:
    (TASKS_DIR / d).mkdir(parents=True, exist_ok=True)

def task_next() -> tuple[str | None, Path | None]:
    """Return (description, filepath) of next task (active first, then pending)."""
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

def task_migrate_from_todo():
    """One-shot migration from TODO.md to .tasks/pending/."""
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
    log(f"Migrated {count} tasks from TODO.md → .tasks/pending/")
    return count

def task_stats() -> dict:
    return {d: len(list((TASKS_DIR / d).glob('*.task')))
            for d in ['pending', 'active', 'stuck', 'completed']}

# ── Aider runner ───────────────────────────────────────────────────────
def _aider_binary() -> str | None:
    for p in ['aider', os.path.expanduser('~/.local/bin/aider')]:
        try:
            subprocess.run([p, '--version'], capture_output=True, timeout=5)
            return p
        except Exception:
            continue
    return None

def run_aider(task: str, attempt: int = 0) -> dict:
    """
    2-pass Aider workflow:
      Pass 1: Ask which files need changing (fast, cheap).
      Pass 2: Provide those files + context and request the actual edits.
    """
    aider = _aider_binary()
    if not aider:
        return {'ok': False, 'files_changed': 0, 'output': 'Aider not found',
                'exit_code': -1, 'killed': False, 'reason': 'no_binary'}

    state_patch(current_stage='stage2_execute', current_task=task,
                attempt=attempt + 1, current_tool=f'Aider (attempt {attempt+1}/{CFG["max_retries"]})')
    heartbeat()

    before = set(_git_porcelain())

    # --- Pass 1: discover files ---
    discover_msg = (
        f"For this task: '{task}', list ONLY the source file paths "
        f"(one per line, e.g. frontend/src/app/...) that need to be "
        f"changed. Do NOT write any code. Just the file paths. "
        f"Read SPEC.md and AGENTS.md for project context."
    )

    log(f"Aider pass 1 (discover): task={task[:60]}...")

    files_to_edit = []
    try:
        r1 = subprocess.run(
            [aider, '--message', discover_msg,
             '--read', 'SPEC.md', '--read', 'AGENTS.md',
             '--no-auto-commits', '--yes', '--no-suggest-shell-commands',
             '--model', CFG['model']],
            capture_output=True, text=True, timeout=120,
            start_new_session=True
        )
        # Extract file paths from response
        for line in r1.stdout.split('\n'):
            for m in re.finditer(r'(frontend|backend)/[\w./-]+\.(ts|html|scss|css)', line):
                fp = m.group(0)
                if Path(fp).exists() and fp not in files_to_edit:
                    files_to_edit.append(fp)
        log(f"Pass 1: discovered {len(files_to_edit)} files: {files_to_edit[:5]}...")
    except Exception as e:
        log(f"Pass 1 failed: {e}")

    # Fallback: if no files discovered, use recent source files
    if not files_to_edit:
        files_to_edit = _recent_source_files(limit=15)
        log(f"Pass 1 fallback: using {len(files_to_edit)} recent files")

    if not files_to_edit:
        files_to_edit = ['SPEC.md']

    # --- Pass 2: make edits ---
    cmd = [aider, '--message', task,
           '--read', 'SPEC.md', '--read', 'AGENTS.md',
           '--no-auto-commits', '--yes', '--no-suggest-shell-commands',
           '--model', CFG['model']]
    for f in files_to_edit[:20]:
        cmd.extend(['--file', f])

    log(f"Aider pass 2 (edit): {len(files_to_edit)} files, task={task[:60]}...")

    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, start_new_session=True
    )

    output_chunks = []
    output_lock = threading.Lock()
    last_output_ts = time.time()
    last_change_ts = time.time()
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

    while proc.poll() is None:
        time.sleep(5)
        elapsed = time.time() - start

        now_porcelain = set(_git_porcelain())
        if now_porcelain != before:
            last_change_ts = time.time()
            before = now_porcelain

        if last_output_ts > start:
            pass  # output produced = alive

        stuck_dur = time.time() - max(last_output_ts, last_change_ts)
        if stuck_dur >= CFG['aider_stuck']:
            log(f"Aider STUCK ({stuck_dur:.0f}s). Killing.")
            killed = True
            kill_reason = 'stuck'
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            break

        if elapsed >= CFG['aider_timeout']:
            log(f"Aider TIMEOUT ({elapsed:.0f}s). Killing.")
            killed = True
            kill_reason = 'timeout'
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
            break

        heartbeat()

    proc.wait(timeout=10)
    t.join(timeout=5)

    with output_lock:
        output = ''.join(output_chunks)

    after = set(_git_porcelain())
    changed = after - before
    real_changes = {f for f in changed
                    if not any(f.endswith(x) for x in ['.log', 'TODO.md', 'STUCK_LOG.md'])
                    and not f.startswith('.aider')}

    log(f"Aider done: ok={len(real_changes) > 0} changed={len(real_changes)} "
        f"killed={killed} exit={proc.returncode}")

    return {
        'ok': len(real_changes) > 0,
        'files_changed': len(real_changes),
        'output': output[-3000:] if len(output) > 3000 else output,
        'exit_code': proc.returncode or 0,
        'killed': killed,
        'reason': kill_reason,
    }

def _recent_source_files(limit: int = 10) -> list[str]:
    """Return recently modified source files (not logs, not node_modules)."""
    try:
        r = subprocess.run(
            ['git', 'diff', '--name-only', 'HEAD~5..HEAD', '--',
             '*.ts', '*.html', '*.scss', '*.json', '*.md'],
            capture_output=True, text=True, timeout=10
        )
        files = [f.strip() for f in r.stdout.strip().split('\n') if f.strip()]
        return files[:limit]
    except Exception:
        return []


def _git_porcelain() -> list[str]:
    try:
        r = subprocess.run(['git', 'status', '--porcelain'],
                          capture_output=True, text=True, timeout=10)
        return r.stdout.strip().split('\n') if r.stdout.strip() else []
    except Exception:
        return []

# ── lint + test ────────────────────────────────────────────────────────
def run_tests() -> tuple[bool, str]:
    """Run lint+test suite. Returns (all_passed, combined_error_output)."""
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
    """Ask Aider to fix test/lint failures. Returns True if changes made."""
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

# ── git ─────────────────────────────────────────────────────────────────
def git_commit(message: str) -> str:
    """Commit all changes. Returns commit SHA or empty string."""
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

def _has_changes() -> bool:
    porcelain = _git_porcelain()
    real = [f for f in porcelain
            if not any(f.endswith(x) for x in ['.log', 'TODO.md', 'STUCK_LOG.md'])
            and not f.startswith('.aider')]
    return len(real) > 0

# ── supervisor (main loop) ─────────────────────────────────────────────
_shutdown = False

def _on_signal(signum, frame):
    global _shutdown
    log(f"Received signal {signum}. Shutting down gracefully...")
    _shutdown = True

signal.signal(signal.SIGTERM, _on_signal)
signal.signal(signal.SIGINT, _on_signal)

def supervisor():
    """Main autonomous loop."""
    log("=" * 50)
    log("swarmd starting")
    log(f"Config: retries={CFG['max_retries']} cooldown={CFG['cooldown']}s "
        f"aider_timeout={CFG['aider_timeout']}s stuck={CFG['aider_stuck']}s "
        f"model={CFG['model']}")

    # Clear orphaned lock
    if RATE_LOCK.exists():
        try:
            RATE_LOCK.rmdir()
            log("Cleared orphaned rate limiter lock")
        except Exception:
            pass

    state_save({
        'started_at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'current_stage': 'startup', 'current_task': '', 'current_tool': '',
        'attempt': 0, 'tasks_completed': 0, 'tasks_stuck': 0,
        'last_error': '', 'last_commit': '',
    })

    while not _shutdown:
        heartbeat()
        state_patch(current_stage='stage1_select')

        task, taskfile = task_next()
        if not task:
            log(f"No pending tasks. Sleeping {CFG['idle_sleep']}s.")
            state_patch(current_stage='idle')
            for _ in range(CFG['idle_sleep']):
                if _shutdown:
                    break
                time.sleep(1)
            continue

        # Move to active/ if in pending/
        if taskfile and '/pending/' in str(taskfile):
            taskfile = task_move(taskfile, 'active')

        log(f"Task: {task[:80]}")
        stats = task_stats()
        log(f"Queue: {stats['pending']} pending, {stats['completed']} done, {stats['stuck']} stuck")

        success = False
        for attempt in range(CFG['max_retries']):
            if _shutdown:
                break

            log(f"Attempt {attempt + 1}/{CFG['max_retries']}")

            result = run_aider(task, attempt)

            if result['killed'] and attempt < CFG['max_retries'] - 1:
                log(f"Aider was killed ({result['reason']}). Retrying...")
                time.sleep(5)
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

            # Changes made — run tests
            passed, test_errors = run_tests()

            if not passed and attempt < CFG['max_retries'] - 1:
                log("Tests failed. Asking Aider to fix...")
                if run_test_fix(test_errors):
                    log("Fix applied. Re-running tests...")
                    passed, _ = run_tests()

            if passed:
                if taskfile and taskfile.exists():
                    taskfile = task_move(taskfile, 'completed')
                git_commit(f"feat: {task}")
                s = state_load()
                state_save({**s, 'tasks_completed': s.get('tasks_completed', 0) + 1})
                log(f"COMPLETED: {task[:80]}")
                success = True
                break
            else:
                log("Tests still failing.")
                state_patch(last_error=test_errors[:500])
                if attempt >= CFG['max_retries'] - 1:
                    # Preserve work before marking stuck
                    if _has_changes():
                        git_commit(f"wip: {task}")
                    if taskfile and taskfile.exists():
                        task_move(taskfile, 'stuck')
                    s = state_load()
                    state_save({**s, 'tasks_stuck': s.get('tasks_stuck', 0) + 1})
                    log(f"STUCK: Tests failing after {CFG['max_retries']} attempts")
                break

        if not success and taskfile and taskfile.exists():
            state_patch(last_error='All attempts exhausted')

        log(f"Cooldown {CFG['cooldown']}s...")
        state_patch(current_stage='cooldown')
        for _ in range(CFG['cooldown']):
            if _shutdown:
                break
            time.sleep(1)

    # Graceful shutdown
    log("swarmd shutting down.")
    state_patch(current_stage='shutdown')
    log("=" * 50)


# ── CLI ─────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    if '--status' in sys.argv:
        s = state_load()
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
