#!/bin/bash
# pm-loop.sh - The Product Manager Agent
set -a
source .env 2>/dev/null || true
set +a

echo "Starting 24/7 PM Swarm..."

while true; do
    echo "========================================"
    echo "PM STAGE: GITHUB ISSUE SYNC"
    echo "========================================"
    
    # Fully automated: Fetch open issues from GitHub (works on private repos if GITHUB_TOKEN is in .env)
    if [ -z "$GITHUB_TOKEN" ]; then
        ISSUES=$(curl -s "https://api.github.com/repos/elgansayer/hellotalk/issues?state=open" | grep -o '"title": "[^"]*' | cut -d'"' -f4)
    else
        ISSUES=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" "https://api.github.com/repos/elgansayer/hellotalk/issues?state=open" | grep -o '"title": "[^"]*' | cut -d'"' -f4)
    fi
    
    if [ -n "$ISSUES" ]; then
        echo "Found active issues on GitHub. Syncing with TODO.md backlog..."
        while IFS= read -r ISSUE; do
            # If the issue isn't already in TODO.md, append it autonomously
            if ! grep -qF "$ISSUE" TODO.md; then
                echo "Adding new task from GitHub: $ISSUE"
                echo "- [ ] $ISSUE" >> TODO.md
                git commit -am "ci(pm): imported new task from GitHub - $ISSUE"
                git push origin HEAD || true
            fi
        done <<< "$ISSUES"
    else
        echo "No new GitHub issues found."
    fi
    
    echo "Sleeping for 60 minutes before next PM sync..."
    sleep 3600
done
