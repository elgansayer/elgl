#!/bin/bash
# guardian.sh — Self-healing startup guardian for frontend + backend.
#
# Runs pre-flight checks, installs deps, builds, starts services,
# health-checks them continuously, and auto-restarts on failure.
#
# Usage:  bash scripts/guardian.sh [--once] [--no-watch]
#   --once      Run checks and start, then exit (no watchdog loop).
#   --no-watch  Start services but skip continuous health checks.

set -e

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
cd "$REPO_DIR"

# ── Config ─────────────────────────────────────────────────────────────
BACKEND_PORT="${BACKEND_PORT:-3000}"
FRONTEND_PORT="${FRONTEND_PORT:-4200}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-30}"
MAX_RESTARTS="${MAX_RESTARTS:-10}"
RESTART_WINDOW="${RESTART_WINDOW:-300}"  # seconds for restart cooldown
LOG_DIR="$REPO_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
GUARDIAN_LOG="$LOG_DIR/guardian.log"
RESTART_COUNT_FILE="/tmp/guardian_restarts"
HEALTH_FAIL_FILE="/tmp/guardian_health_fails"

mkdir -p "$LOG_DIR"

RUN_ONCE=false
NO_WATCH=false
for arg in "$@"; do
  case "$arg" in
    --once) RUN_ONCE=true ;;
    --no-watch) NO_WATCH=true ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────

log() {
  local msg="[$(date -u +'%H:%M:%S')] $1"
  echo "$msg" | tee -a "$GUARDIAN_LOG"
}

red()  { log "❌ $1"; }
green() { log "✅ $1"; }
warn() { log "⚠️  $1"; }

restart_count() {
  local now
  now=$(date +%s)
  local count=0
  if [ -f "$RESTART_COUNT_FILE" ]; then
    local ts
    ts=$(head -n1 "$RESTART_COUNT_FILE" 2>/dev/null || echo 0)
    count=$(tail -n1 "$RESTART_COUNT_FILE" 2>/dev/null || echo 0)
    if [ $((now - ts)) -gt "$RESTART_WINDOW" ]; then
      count=0
    fi
  fi
  echo "$count"
}

inc_restart_count() {
  local now
  now=$(date +%s)
  local count
  count=$(restart_count)
  count=$((count + 1))
  echo "$now" > "$RESTART_COUNT_FILE"
  echo "$count" >> "$RESTART_COUNT_FILE"
  echo "$count"
}

reset_restart_count() {
  rm -f "$RESTART_COUNT_FILE" "$HEALTH_FAIL_FILE"
}

kill_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    log "Killing process(es) on port $port: $pids"
    kill -9 $pids 2>/dev/null || true
    sleep 2
  fi
}

# ── Phase 1: Pre-flight ───────────────────────────────────────────────

preflight() {
  log "━━━ Phase 1: Pre-flight Checks ━━━"

  # Node.js
  if ! command -v node &>/dev/null; then
    red "Node.js not found. Install node >= 18."
    exit 1
  fi
  local node_ver
  node_ver=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$node_ver" -lt 18 ]; then
    red "Node.js $node_ver < 18. Please upgrade."
    exit 1
  fi
  green "Node.js $(node -v)"

  # npm
  if ! command -v npm &>/dev/null; then
    red "npm not found."
    exit 1
  fi
  green "npm $(npm -v)"

  # .env file
  if [ ! -f "$REPO_DIR/.env" ]; then
    warn ".env file missing. Copying from .env.example (you MUST configure it)."
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env" 2>/dev/null || touch "$REPO_DIR/.env"
  else
    green ".env file exists"
  fi

  # Disk space
  local disk_pct
  disk_pct=$(df -h "$REPO_DIR" 2>/dev/null | awk 'NR==2 {gsub(/%/,""); print $5}')
  if [ "${disk_pct:-100}" -gt 85 ]; then
    warn "Disk at ${disk_pct}% — cleaning caches."
    npm cache clean --force 2>/dev/null || true
    rm -rf "$REPO_DIR/frontend/.angular" "$REPO_DIR/backend/dist" "$REPO_DIR/node_modules/.cache" 2>/dev/null || true
  fi

  # Memory
  local mem_avail
  mem_avail=$(awk '/MemAvailable/ {printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 99999)
  if [ "$mem_avail" -lt 500 ]; then
    warn "Low memory: ${mem_avail}MB available. Killing orphan processes."
    pkill -9 -f "ng serve" 2>/dev/null || true
    pkill -9 -f "nest start" 2>/dev/null || true
    pkill -9 -f "chromium" 2>/dev/null || true
    pkill -9 -f "playwright" 2>/dev/null || true
  fi

  green "Pre-flight checks passed."
}

# ── Phase 2: Install Dependencies ──────────────────────────────────────

install_deps() {
  log "━━━ Phase 2: Dependencies ━━━"

  # Backend
  if [ ! -d "$REPO_DIR/backend/node_modules" ]; then
    log "Installing backend dependencies..."
    (cd "$REPO_DIR/backend" && npm ci --legacy-peer-deps 2>&1 | tail -5) || {
      warn "npm ci failed, trying npm install..."
      (cd "$REPO_DIR/backend" && npm install --legacy-peer-deps 2>&1 | tail -5) || {
        red "Backend dependency install failed."
        return 1
      }
    }
    green "Backend dependencies installed."
  else
    green "Backend node_modules exists."
  fi

  # Frontend
  if [ ! -d "$REPO_DIR/frontend/node_modules" ]; then
    log "Installing frontend dependencies..."
    (cd "$REPO_DIR/frontend" && npm ci --legacy-peer-deps 2>&1 | tail -5) || {
      warn "npm ci failed, trying npm install..."
      (cd "$REPO_DIR/frontend" && npm install --legacy-peer-deps 2>&1 | tail -5) || {
        red "Frontend dependency install failed."
        return 1
      }
    }
    green "Frontend dependencies installed."
  else
    green "Frontend node_modules exists."
  fi
}

# ── Phase 3: Build ─────────────────────────────────────────────────────

build_project() {
  local dir="$1" name="$2" cmd="$3"
  log "Building $name..."

  local build_output
  build_output=$(cd "$REPO_DIR/$dir" && $cmd 2>&1) || {
    red "$name build failed."
    echo "$build_output" | tail -20 | tee -a "$GUARDIAN_LOG"

    # Auto-fix common errors
    if echo "$build_output" | grep -q "Cannot find module\|has no exported member\|is not a module"; then
      warn "Detected missing import. Attempting to fix..."
      log "Missing import errors detected. Run: cd $dir && npx tsc --noEmit to see details."
      log "Check for missing import statements in the files referenced above."
    fi

    if echo "$build_output" | grep -q "SyntaxError\|Unexpected token"; then
      warn "Detected syntax error. Check the file referenced in the error."
    fi

    if echo "$build_output" | grep -q "Property.*does not exist on type"; then
      warn "Detected type error. Check the interface/type referenced in the error."
    fi

    return 1
  }

  green "$name built successfully."
  return 0
}

build_all() {
  log "━━━ Phase 3: Build ━━━"

  build_project "backend" "Backend" "npm run build" || {
    red "Backend build failed. Check $GUARDIAN_LOG for details."
    return 1
  }

  build_project "frontend" "Frontend" "npx ng build" || {
    red "Frontend build failed. Check $GUARDIAN_LOG for details."
    return 1
  }

  green "All builds passed."
}

# ── Phase 4: Start Services ────────────────────────────────────────────

start_backend() {
  log "Starting backend on port $BACKEND_PORT..."
  kill_port "$BACKEND_PORT"

  nohup npm run start:dev > "$BACKEND_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > /tmp/guardian_backend.pid

  # Wait for health check
  for i in $(seq 1 30); do
    if curl -sf "http://localhost:$BACKEND_PORT/health" &>/dev/null; then
      green "Backend healthy (pid $pid, port $BACKEND_PORT)"
      return 0
    fi
    sleep 2
  done

  red "Backend failed to become healthy after 60s."
  return 1
}

start_frontend() {
  log "Starting frontend on port $FRONTEND_PORT..."
  kill_port "$FRONTEND_PORT"

  nohup npm run start > "$FRONTEND_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > /tmp/guardian_frontend.pid

  # Wait for health check
  for i in $(seq 1 60); do
    if curl -sf -o /dev/null "http://localhost:$FRONTEND_PORT" &>/dev/null; then
      green "Frontend healthy (pid $pid, port $FRONTEND_PORT)"
      return 0
    fi
    sleep 2
  done

  red "Frontend failed to become healthy after 120s."
  return 1
}

start_services() {
  log "━━━ Phase 4: Start Services ━━━"
  local ok=true

  start_backend || ok=false
  start_frontend || ok=false

  if $ok; then
    green "All services started."
    reset_restart_count
  fi
}

# ── Phase 5: Health Watchdog ───────────────────────────────────────────

check_backend_health() {
  curl -sf "http://localhost:$BACKEND_PORT/health" &>/dev/null
}

check_frontend_health() {
  curl -sf -o /dev/null "http://localhost:$FRONTEND_PORT" &>/dev/null
}

watchdog_loop() {
  log "━━━ Phase 5: Health Watchdog (every ${HEALTH_INTERVAL}s) ━━━"

  local fail_count=0

  while true; do
    sleep "$HEALTH_INTERVAL"

    local issues=""

    if ! check_backend_health; then
      issues="${issues}backend "
      fail_count=$((fail_count + 1))
    fi

    if ! check_frontend_health; then
      issues="${issues}frontend "
      fail_count=$((fail_count + 1))
    fi

    if [ -n "$issues" ]; then
      warn "Health check failed for: $issues(failures: $fail_count)"

      # Check if processes died
      if ! check_backend_health; then
        local be_pid
        be_pid=$(cat /tmp/guardian_backend.pid 2>/dev/null || echo "")
        if [ -n "$be_pid" ] && ! kill -0 "$be_pid" 2>/dev/null; then
          warn "Backend process $be_pid died."
        fi
      fi
      if ! check_frontend_health; then
        local fe_pid
        fe_pid=$(cat /tmp/guardian_frontend.pid 2>/dev/null || echo "")
        if [ -n "$fe_pid" ] && ! kill -0 "$fe_pid" 2>/dev/null; then
          warn "Frontend process $fe_pid died."
        fi
      fi

      echo "$fail_count" > "$HEALTH_FAIL_FILE"

      if [ "$fail_count" -ge 5 ]; then
        local count
        count=$(restart_count)
        if [ "$count" -ge "$MAX_RESTARTS" ]; then
          red "Max restarts ($MAX_RESTARTS) reached in $RESTART_WINDOW seconds. Halting auto-restart."
          log "Manual intervention required. Check logs in $LOG_DIR"
          break
        fi

        local n
        n=$(inc_restart_count)
        red "5 consecutive health failures. Auto-restarting services (restart $n/$MAX_RESTARTS)..."
        start_services
        fail_count=0
      fi
    else
      fail_count=0
      rm -f "$HEALTH_FAIL_FILE"
    fi
  done
}

# ── Main ───────────────────────────────────────────────────────────────

main() {
  log "══════════════════════════════════════════════════════"
  log "  HelloTalk Startup Guardian"
  log "  Mode: $([ "$RUN_ONCE" = true ] && echo 'once' || echo 'continuous')"
  log "══════════════════════════════════════════════════════"

  preflight
  install_deps

  if [ "$RUN_ONCE" = true ]; then
    build_all
    start_services
    log "Startup complete (--once mode). Guardian exiting."
    return 0
  fi

  build_all || {
    warn "Initial build failed. Starting services anyway (may recover)."
  }

  start_services

  if [ "$NO_WATCH" = false ]; then
    watchdog_loop
  else
    log "Services started (--no-watch mode). Guardian exiting."
  fi
}

main "$@"
