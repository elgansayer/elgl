#!/usr/bin/env bash
# scripts/preflight-models.sh
#
# Validates that a "provider/model" reference is actually callable BEFORE Aider is
# launched. Aider treats "this model does not exist" and "this model tried and failed"
# identically, so a dead model silently burns a slot in the fallback waterfall and the
# pipeline commits log churn instead of code.
#
# Two failure modes this catches, both observed in production:
#   1. The model id does not exist at all (gemini/gemini-1.5-pro -> 404 NOT_FOUND).
#   2. The model id exists but does not serve /chat/completions, which is the only
#      endpoint Aider uses (openai/gpt-5.5 -> "not accessible via the
#      /chat/completions endpoint").
#
# Usage:
#   source scripts/preflight-models.sh
#   model_is_callable "openai/claude-opus-4.7" && echo ok
#
# Provider catalogues are cached for 30 minutes so a tight loop does not hammer the
# model list endpoints.
#
# GitHub Copilot's /models endpoint is not deterministic: roughly one call in four
# returns a truncated 28-entry catalogue instead of the full 47, omitting models it
# will happily serve. Declaring a model dead on the strength of one truncated reply
# would be worse than having no preflight at all, so every catalogue is sampled
# several times and merged by id.

PREFLIGHT_CACHE_DIR="${TMPDIR:-/tmp}/hellotalk-preflight"
PREFLIGHT_SAMPLES="${PREFLIGHT_SAMPLES:-3}"

_preflight_curl() {
    local provider="$1" out="$2"
    case "$provider" in
        openai)
            curl -sf -m 20 -H "Authorization: Bearer ${OPENAI_API_KEY}" \
                "${OPENAI_API_BASE:-https://api.openai.com/v1}/models" -o "$out"
            ;;
        gemini)
            curl -sf -m 20 \
                "https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}" \
                -o "$out"
            ;;
        deepseek)
            curl -sf -m 20 -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" \
                "https://api.deepseek.com/models" -o "$out"
            ;;
        *)
            return 2
            ;;
    esac
}

# Downloads the provider's model catalogue, re-using a copy fetched in the last 30 min.
_preflight_fetch_catalogue() {
    local provider="$1"
    local cache="$PREFLIGHT_CACHE_DIR/$provider.json"

    mkdir -p "$PREFLIGHT_CACHE_DIR"

    if [ -s "$cache" ] && [ -n "$(find "$cache" -mmin -30 2>/dev/null)" ]; then
        return 0
    fi

    local sample_dir
    sample_dir="$(mktemp -d "$PREFLIGHT_CACHE_DIR/$provider.samples.XXXXXX")"

    local i got=0
    for ((i = 1; i <= PREFLIGHT_SAMPLES; i++)); do
        if _preflight_curl "$provider" "$sample_dir/$i.json"; then
            got=$((got + 1))
        elif [ $? -eq 2 ]; then
            rm -rf -- "$sample_dir"
            return 2  # Unknown provider: no catalogue to check against.
        fi
    done

    if [ $got -eq 0 ]; then
        rm -rf -- "$sample_dir"
        return 1
    fi

    python3 - "$cache" "$sample_dir" <<'PY'
import glob, json, os, sys

cache, sample_dir = sys.argv[1], sys.argv[2]
key = None
merged = {}

for path in sorted(glob.glob(os.path.join(sample_dir, "*.json"))):
    try:
        with open(path) as fh:
            doc = json.load(fh)
    except (OSError, ValueError):
        continue
    for k in ("data", "models"):
        if isinstance(doc.get(k), list):
            key = key or k
            for entry in doc[k]:
                ident = entry.get("id") or entry.get("name")
                if not ident:
                    continue
                # Prefer the richest record seen for an id: truncated replies tend to
                # drop the supported_endpoints/policy fields we actually test on.
                if len(entry) >= len(merged.get(ident, {})):
                    merged[ident] = entry

if not merged:
    sys.exit(1)

with open(cache, "w") as fh:
    json.dump({key: list(merged.values())}, fh)
PY
    local rc=$?
    rm -rf -- "$sample_dir"
    return $rc
}

# Sends one 1-token request to settle whether the proxy will actually serve this model.
#   0 -> served, or refused for a reason that is not the model's fault (quota, transient)
#   1 -> definitively refused because of what the model is
# A 429 must NOT count as dead: it means the model was accepted and the subscription
# quota is spent, which the waterfall's rate-limit watcher already handles by moving on.
_preflight_probe_openai() {
    local model="$1"
    local verdict_file="$PREFLIGHT_CACHE_DIR/probe-openai-${model//\//_}"

    if [ -f "$verdict_file" ] && [ -n "$(find "$verdict_file" -mmin -30 2>/dev/null)" ]; then
        return "$(cat "$verdict_file")"
    fi

    local body_file="$PREFLIGHT_CACHE_DIR/probe-body.$$"
    local code
    code=$(curl -s -m 30 -o "$body_file" -w '%{http_code}' -X POST \
        -H "Authorization: Bearer ${OPENAI_API_KEY}" \
        -H "Content-Type: application/json" \
        "${OPENAI_API_BASE:-https://api.openai.com/v1}/chat/completions" \
        -d "{\"model\":\"$model\",\"max_tokens\":1,\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}")

    # If curl fails (e.g. DNS error, timeout), code can be empty or "000". This should
    # not be treated as a callable model. The main catalogue fetch handles this as
    # "unverifiable", but the probe should be stricter and fail closed.
    if [ -z "$code" ] || [ "$code" = "000" ]; then
        rm -f "$body_file"
        echo "1" > "$verdict_file" # Treat as dead if probe fails to connect.
        return 1
    fi

    local verdict=0
    # A quota/rate-limit error (any code) must pass the preflight check (return 0), so
    # the main loop's watcher can see the error in Aider's log and correctly fall
    # through to the next model for the current attempt.
    if grep -i -q -E 'quota|rate limit' "$body_file" 2>/dev/null; then
        verdict=0
    elif [ "$code" = "400" ] || [ "$code" = "404" ]; then
        # This is a definitive "model unavailable" error, not a transient quota issue.
        # Mark it dead for 30 mins so we don't waste cycles on it.
        if grep -qE 'not available for integrator|unsupported_api_for_model|model_not_found|does not exist' \
            "$body_file" 2>/dev/null; then
            verdict=1
        fi
    fi

    rm -f "$body_file"
    echo "$verdict" > "$verdict_file"
    return $verdict
}

# model_is_callable "provider/model"
#   0 -> confirmed callable
#   1 -> confirmed dead (present but unusable, or absent from a catalogue we did read)
#   3 -> unverifiable (catalogue unreachable or provider unknown). Callers should fail
#        open on this, but a run where EVERY model is unverifiable means the credentials
#        or the network are broken, not that the task is impossible. Distinguishing the
#        two is what stops a bad API key from marking good tasks [STUCK].
model_is_callable() {
    local ref="$1"
    local provider="${ref%%/*}"
    local model="${ref#*/}"
    local cache="$PREFLIGHT_CACHE_DIR/$provider.json"

    _preflight_fetch_catalogue "$provider"
    local fetch_status=$?

    if [ $fetch_status -eq 2 ]; then
        return 3  # Unknown provider: nothing to check against.
    fi
    if [ ! -s "$cache" ]; then
        echo "  preflight: cannot reach $provider catalogue, allowing $ref unchecked" >&2
        return 3
    fi

    # The catalogue is necessary but not sufficient for the GitHub Copilot proxy: it also
    # gates by integrator, and refuses models it happily lists. Aider identifies as
    # "copilot-language-server", for which gpt-5.4 is rejected even though the catalogue
    # advertises /chat/completions support. Only a real request settles it.
    if [ "$provider" = "openai" ]; then
        _preflight_probe_openai "$model" || return 1
    fi

    PREFLIGHT_PROVIDER="$provider" PREFLIGHT_MODEL="$model" python3 - "$cache" <<'PY'
import json, os, sys

provider = os.environ["PREFLIGHT_PROVIDER"]
wanted = os.environ["PREFLIGHT_MODEL"]

try:
    with open(sys.argv[1]) as fh:
        doc = json.load(fh)
except (OSError, ValueError):
    sys.exit(0)  # Unparseable catalogue: fail open, same as an unreachable endpoint.

if provider == "gemini":
    for m in doc.get("models", []):
        if m.get("name", "").removeprefix("models/") != wanted:
            continue
        # A model that cannot generateContent is useless to Aider.
        methods = m.get("supportedGenerationMethods")
        sys.exit(0 if (methods is None or "generateContent" in methods) else 1)
    sys.exit(1)

for m in doc.get("data", []):
    if m.get("id") != wanted:
        continue
    # GitHub Copilot's proxy advertises models it will not serve over
    # /chat/completions. Stock OpenAI omits the field entirely, so absence means fine.
    endpoints = m.get("supported_endpoints")
    if endpoints is not None and "/chat/completions" not in endpoints:
        sys.exit(1)
    if (m.get("policy") or {}).get("state", "enabled") != "enabled":
        sys.exit(1)
    sys.exit(0)
sys.exit(1)
PY
}
