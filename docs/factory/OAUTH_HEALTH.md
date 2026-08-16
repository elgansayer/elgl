# OpenHands Codex OAuth Health

This document applies only to the active OpenHands Factory daemon on the VPS. The retired AI swarm is not an authentication fallback and must not receive or inspect current Factory credentials.

## Production provider order

1. ChatGPT/OpenAI subscription OAuth using the configured Codex model.
2. OpenCode Go for a fresh retry conversation when the subscription provider is unavailable.
3. Gemini is disabled by default and is not part of the normal production chain.

Provider choice is conversation-scoped. A running multi-turn conversation must not bounce between providers per LLM call.

## Credential ownership

OpenHands stores the OpenAI subscription cache below the dedicated service account home at `~/.openhands/auth/openai_oauth.json`. The controller may inspect this cache through the OpenHands SDK. Worker containers must never receive the OAuth cache, refresh token, access token, GitHub token or Telegram credentials.

File existence is not proof of usable authentication. The Factory now distinguishes missing, malformed, expired, unsupported-model, authentication-failure and throttled states.

## Local health check

The scheduler uses OpenHands' subscription-auth API to validate cached credentials and model compatibility without performing a network completion. Invalid subscription state causes a new task attempt to select OpenCode Go when its circuit breaker permits the call.

This does not mutate or refresh credentials interactively. Re-authentication remains an operator action:

```bash
sudo -u hellotalk-factory env HOME=/var/lib/hellotalk-factory/home \
  /opt/hellotalk-factory/venv/bin/hellotalk-factory auth openai --force
```

## Online readiness check

Before activating a new Factory environment, run:

```bash
sudo -u hellotalk-factory env HOME=/var/lib/hellotalk-factory/home \
  /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
```

`doctor --online` performs a bounded, non-mutating completion through `LLM.subscription_login()` using the configured Codex model. It verifies the real subscription backend rather than trusting the cache alone. The check must pass before switching the production virtualenv symlink or restarting onto a newly built Factory environment.

A failure is classified in operator output. Typical actions are:

- `missing` or `malformed`: inspect ownership/permissions and re-authenticate.
- `expired` or `auth-failure`: force subscription login and repeat the online check.
- `unsupported-model`: set `OPENHANDS_OPENAI_MODEL` to a Codex subscription model supported by the installed OpenHands SDK.
- `throttled`: do not retry in a tight loop; allow provider backoff and OpenCode Go fallback.

Never paste OAuth cache contents into logs, issues, pull requests, chat, or troubleshooting commands.

## Upgrade gate

Build the candidate virtualenv separately. Run tests and the online doctor using that candidate environment while preserving the service account HOME. Activate the candidate only after the check succeeds. If it fails, leave the current production symlink untouched and investigate the classified error.

This gate is deliberately stricter than ordinary unit tests because model support, credential refresh behavior and subscription backend availability can change independently of repository code.
