#!/bin/bash
# swarm-tasks.sh - Task queue operations using .tasks/ directory.
#
# Replaces fragile TODO.md grep/sed with atomic file operations.
# Directory structure:
#   .tasks/pending/    - tasks waiting to be worked on
#   .tasks/active/     - task currently being worked on (exactly one file)
#   .tasks/stuck/      - tasks that exceeded max retries
#   .tasks/completed/  - finished tasks
#
# Each file contains one line: the task description.
# Filenames: NNNN-brief-slug.task  (NNNN is the TODO.md phase number, optional)
#
# Source this and use the functions below.

TASKS_ROOT="${SWARM_ROOT:-.}/.tasks"
for d in pending active stuck completed; do
    mkdir -p "$TASKS_ROOT/$d" 2>/dev/null || true
done

# Returns the description of the next pending task, or empty string.
# Checks active/ first (retry current task), then pending/ (new tasks).
swarm_task_next() {
    local task_file
    task_file=$(ls "$TASKS_ROOT/active"/*.task 2>/dev/null | head -n1)
    [ -z "$task_file" ] && task_file=$(ls "$TASKS_ROOT/pending"/*.task 2>/dev/null | head -n1)
    [ -z "$task_file" ] && return 1
    head -n1 "$task_file"
}

# Returns the filename of the active task, or next pending task, or empty.
swarm_task_next_file() {
    local f
    f=$(ls "$TASKS_ROOT/active"/*.task 2>/dev/null | head -n1)
    [ -z "$f" ] && f=$(ls "$TASKS_ROOT/pending"/*.task 2>/dev/null | head -n1)
    echo "$f"
}

# Move the first pending task to active. Returns 0 on success.
swarm_task_start() {
    local task_file
    task_file=$(ls "$TASKS_ROOT/pending"/*.task 2>/dev/null | head -n1)
    [ -z "$task_file" ] && return 1
    mv "$task_file" "$TASKS_ROOT/active/" 2>/dev/null && return 0
    return 1
}

# Move the active task to completed.
swarm_task_done() {
    local active
    active=$(ls "$TASKS_ROOT/active"/*.task 2>/dev/null | head -n1)
    [ -z "$active" ] && return 1
    mv "$active" "$TASKS_ROOT/completed/" 2>/dev/null && return 0
    return 1
}

# Move the active task to stuck.
swarm_task_stuck() {
    local active
    active=$(ls "$TASKS_ROOT/active"/*.task 2>/dev/null | head -n1)
    [ -z "$active" ] && return 1
    mv "$active" "$TASKS_ROOT/stuck/" 2>/dev/null && return 0
    return 1
}

# Get the active task description (empty if none).
swarm_task_active_desc() {
    local active
    active=$(ls "$TASKS_ROOT/active"/*.task 2>/dev/null | head -n1)
    [ -z "$active" ] && { echo ""; return 1; }
    head -n1 "$active"
}

# Add a new task to the pending queue.
# Usage: swarm_task_add "Task description" [phase_number]
swarm_task_add() {
    local desc="$1" phase="${2:-0000}"
    local slug
    slug=$(echo "$desc" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-60)
    [ -z "$slug" ] && slug="task"

    local add_lock="/tmp/ai_swarm_task_add.lock"
    (
        flock -w 10 200
        local count
        count=$(ls "$TASKS_ROOT/pending"/*.task 2>/dev/null | wc -l)
        count=$((count + 1))
        printf -v filename "%s-%03d-%s.task" "$phase" "$count" "$slug"
        echo "$desc" > "$TASKS_ROOT/pending/$filename"
    ) 200>"$add_lock"
}

# Count tasks in each state.
swarm_task_stats() {
    local p a s c
    p=$(ls "$TASKS_ROOT/pending"/*.task 2>/dev/null | wc -l)
    a=$(ls "$TASKS_ROOT/active"/*.task 2>/dev/null | wc -l)
    s=$(ls "$TASKS_ROOT/stuck"/*.task 2>/dev/null | wc -l)
    c=$(ls "$TASKS_ROOT/completed"/*.task 2>/dev/null | wc -l)
    echo "pending=$p active=$a stuck=$s completed=$c"
}

# Migrate TODO.md [ ] tasks into .tasks/pending/ (run once).
# Keeps the original TODO.md intact.
swarm_task_migrate() {
    local count=0
    while IFS= read -r line; do
        local task
        task=$(echo "$line" | sed 's/^[[:space:]]*-[[:space:]]*\[ \][[:space:]]*//')
        [ -z "$task" ] && continue
        # Extract phase number from the preceding heading if available
        local phase="0000"
        swarm_task_add "$task" "$phase"
        count=$((count + 1))
    done < <(grep '^[[:space:]]*- \[ \]' TODO.md 2>/dev/null || true)
    echo "Migrated $count tasks from TODO.md to .tasks/pending/"
}
