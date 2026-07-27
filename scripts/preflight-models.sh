#!/bin/bash
# preflight-models.sh - Model availability checks
#
# Provides model_is_callable() used by the fallback pipeline.
# Returns:
#   0 - model is callable and verified
#   1 - model is not callable
#   3 - model is unverifiable (allow through)

model_is_callable() {
    local model="$1"

    case "$model" in
        claude-cli)
            if command -v claude &> /dev/null; then
                return 0
            fi
            return 1
            ;;
        copilot-cli)
            if command -v gh &> /dev/null && gh copilot --help &> /dev/null 2>&1; then
                return 0
            fi
            return 1
            ;;
        antigravity-cli)
            if command -v antigravity &> /dev/null; then
                return 0
            fi
            return 1
            ;;
        deepseek-api)
            if [ -n "$DEEPSEEK_API_KEY" ]; then
                return 0
            fi
            return 1
            ;;
        *)
            return 3  # unverifiable
            ;;
    esac
}
