# Subscription agent installation and authentication

## Security model

Authenticate once outside job execution. The daemon must never open a browser login flow during a task, place
credentials in a repository, include tokens in prompts, or publish credentials in GitHub comments.

The daemon runs as the operator's own login user (`dev`), reusing that account's normal CLI sessions rather than
maintaining a separate service-account credential set. All commands in this guide target that user:

```bash
FACTORY_HOME=/home/dev
FACTORY_PATH="$FACTORY_HOME/.local/bin:$FACTORY_HOME/.opencode/bin:$FACTORY_HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin"
```

Use `sudo -u ... env -i` as shown rather than an interactive shell. The empty starting environment isolates each
probe from any unrelated variables already present in the current session.
Install CLIs into dev's local path or expose a root-owned executable in `/usr/local/bin`.

Never store vendor API keys in the subscription CLI environment. `provider_environment()` strips common API key,
GitHub, and daemon-secret variables so local subscription sessions are not accidentally replaced by PAYG API
authentication.

Do not authenticate GitHub CLI as `hellotalk-factory`. GitHub is not an execution provider. Its token belongs in
root-only `/etc/hellotalk-factory/factory.env` and is scoped by trusted Factory code to individual Git and `gh`
children. A readable `~/.config/gh/hosts.yml`, `~/.git-credentials`, or Git credential store would let an agent
bypass that boundary, so doctor treats such state as a startup failure.

## Claude Code

Official setup: [Claude Code setup](https://code.claude.com/docs/en/setup).

Install using Anthropic's current native installer, then authenticate as dev:

```bash
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" claude auth login
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" \
  claude auth status --json
```

The adapter uses `claude -p` in non-interactive mode, model `fable`, maximum effort, a Factory-enforced phase
timeout, safe mode, no session persistence, and text output. Safe mode preserves authentication and built-in
tools while disabling personal and repository customisations such as hooks, plugins, MCP servers, and
`CLAUDE.md` auto-discovery. Repository-owned Factory policy uses Claude's
`--append-system-prompt` channel, while untrusted task text uses stdin. A failed `auth status --json` reports
`AUTH_REQUIRED` without starting a coding job.

## OpenAI Codex CLI

Official setup: [Codex CLI](https://learn.chatgpt.com/docs/codex/cli) and
[Codex authentication](https://learn.chatgpt.com/docs/auth).

Install the current CLI and authenticate with the ChatGPT subscription. Device authentication is usually easiest
for a headless host:

```bash
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" \
  codex login --device-auth
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" codex login status
```

The adapter requires `login status` to identify ChatGPT authentication. It uses `codex exec`, workspace-write
sandboxing, the current `--approve-for-me` non-interactive approval path, GPT-5.6 Sol, `max` reasoning effort,
an ephemeral session, no colour, and prompt input on stdin. It ignores personal Codex configuration and
exec-policy rules while retaining `CODEX_HOME` authentication. Repository-owned Factory policy uses Codex's
`developer_instructions` configuration channel rather than being concatenated into untrusted issue text.

Do not set `OPENAI_API_KEY` for the subscription adapter. OpenHands emergency authentication is configured
separately and is not inherited by Codex CLI.

## Google coding agent

For Google Free, AI Pro, and AI Ultra subscriptions, use
[Antigravity CLI](https://github.com/google-antigravity/antigravity-cli). Google announced the
[consumer subscription transition](https://github.com/google-gemini/gemini-cli/discussions/27274) on
18 June 2026. Gemini CLI remains supported as an alternate adapter for eligible enterprise, Google Cloud, or API
authentication.

Legacy repository `.env` files may still contain `GEMINI_ENABLED=true`. The Factory environment installer ignores
that retired API route and writes `GEMINI_ENABLED=false`; direct Google routing is controlled only by
`FACTORY_AGENTS_CONFIG`.

Install Antigravity 1.1.1 or newer as dev, then complete Google sign-in once:

```bash
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" \
  sh -c 'curl -fsSL https://antigravity.google/cli/install.sh | bash'
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" agy
```

After authentication, exit without starting repository work. These probes list local version and account-visible
models but do not start a model task:

```bash
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" agy --version
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" agy models
```

The production entry uses `command=agy`, `cli_variant=antigravity`, and the account-visible
`model=gemini-3.1-pro-high` slug verified on 17 August 2026. The adapter passes the prompt on stdin, disables
slash-command expansion, selects high effort, bounds print mode, enables the CLI sandbox, and auto-approves tool
requests inside the Factory-controlled worktree. The outer Factory process runner still owns the final timeout
and process-group termination. Recheck `agy models` before enabling Google because account entitlements can differ.

The provider is enabled in the production file after `agy models` succeeded as `dev` and doctor
reported it healthy on the production host. Keep the same gate after every CLI or credential change: require a
harmless canary as `dev` before accepting production work. The health gate rejects Antigravity older than
1.1.1 and uses `agy models` as the non-generation authentication probe.

To retain Gemini CLI for an eligible deployment, configure `command=gemini` and `cli_variant=gemini`. That path
uses Gemini headless prompt mode, a fixed command-line instruction, Factory content on stdin, `model=auto`, text
output, non-interactive approvals, and trust bypass. Do not assume that a consumer Google AI subscription remains
available through Gemini CLI.

## OpenCode Go

Official setup: [OpenCode CLI](https://opencode.ai/docs/cli/) and
[OpenCode providers](https://opencode.ai/docs/providers/).

Install OpenCode using its current supported installation method. OpenCode 1.18.15 supports selecting OpenCode Go
directly from the login command. It prompts for the credential without placing it in process arguments:

```bash
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" \
  opencode auth login --provider opencode-go
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" opencode auth list
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" \
  opencode models opencode-go
```

Do not export `OPENCODE_GO_API_KEY` from a repository `.env`, a shell profile, the systemd environment, or a
command argument for the direct provider. The direct adapter reads the CLI-owned per-user credential and
deliberately strips API-key variables. If a key was put in a repository file, remove it and rotate any value that
was also pasted into chat, command history, or logs.

The adapter considers the provider healthy only when `auth list` identifies OpenCode Go and `models opencode-go`
contains every configured default and phase model. Those probes prove credential discovery and catalogue access,
not remaining subscription capacity. A tiny repository-free generation can still report `insufficient balance`.
That result is `PROVIDER_QUOTA`, not an authentication failure. Wait for capacity or fund the workspace instead
of repeatedly replacing credentials from the same exhausted workspace. OpenCode documents its credentials under
dev's XDG data directory. Let the CLI own that location and its permissions; do not copy or commit
the credential file.

The non-interactive adapter uses `opencode run`, a mode `0600` temporary prompt attachment inside the isolated
worktree, an explicit model, pure output, automatic tool operation, and a bounded process lifetime. The temporary
prompt is removed before output validation or repository change detection.

The August 2026 policy uses `opencode-go/kimi-k3` for implementation and code repair,
`opencode-go/qwen3.8-max` for planning, architecture, security, and code review, and
`opencode-go/kimi-k2.7-code` for general mechanical actions. Kimi K3 is the strongest available coding choice but
has a much smaller published OpenCode Go allowance, so the lower-cost general-action override preserves capacity
for difficult changes. These names were verified against the authenticated account catalogue on 2026-08-17. Run
`opencode models` after a CLI or subscription change and update configuration explicitly rather than allowing a
silent model substitution.

## OpenHands emergency provider

OpenHands remains behind the same router but uses the existing SDK conversation runner. It is `emergency_only` in
the production policy. Subscription-first operation does not authorise unrestricted PAYG usage.

If no independent OpenHands or OpenAI SDK credential is available, set `providers.openhands.enabled` to `false`
in the root-owned operator `agents.json`. Keep the adapter in source and route definitions so it can be enabled
later, but do not send a task through a stale OAuth session or reuse the same exhausted OpenCode Go workspace as
if it were an independent fallback.

The legacy OpenHands authentication command remains available where its subscription transport is configured:

```bash
sudo -u dev env -i HOME="$FACTORY_HOME" PATH="$FACTORY_PATH" \
  /opt/hellotalk-factory/venv/bin/hellotalk-factory auth openai
```

Optional OpenCode API credentials are also supported only for this compatibility path. Leave
`OPENCODE_GO_API_KEY` and `OPENCODE_GO_MODEL` empty when OpenHands should not use that API route. The direct
OpenCode subscription adapter does not read those variables.

The current budget fields are guard hooks and observability settings. They are not exact cross-vendor billing
meters. Do not configure the optional API route unless the operator has separately authorised its spend, and do
not claim an enforceable dollar cap for a provider that does not expose usage cost.

## Credential locations and isolation

Provider directories can change between CLI releases. Use each official CLI's own auth command to discover and
maintain its files. `credential_paths` and `runtime_paths` in `agents.json` are explicit paths relative to the operator
home directory. Startup validation rejects absolute paths, parent traversal, duplicates, and overlaps. Update these
lists when a CLI moves its session rather than exposing the whole home.

Direct CLIs execute as dev and access only their declared subscription paths. Each attempt enters
private user, mount, PID, and proc namespaces with an otherwise empty synthetic home. The sandbox restores the
assigned worktree, the canonical repository read-only, provider-owned credential paths read-write, and executable
paths read-only. It also remounts `/opt/hellotalk-factory` read-only and replaces `/tmp`, `/var/tmp`, and `/dev/shm`
with private filesystems. Another provider's session, durable Factory state, Factory logs, `/run/user`, and host
temporary files remain hidden. Proxy and vendor API-key variables are not inherited. `factory.env` is root-only,
the daemon is non-dumpable, parsed secrets are removed from ordinary child environments, and provider subprocesses
receive a small allowlist. Repository verification is stricter again: it receives no provider path and no external
network.

The provider's own session is necessarily readable by that provider, and direct CLIs require outbound access to
their vendor. This is not equivalent to a secretless worker. On a public repository, keep
`FACTORY_REQUIRE_TRUSTED_INTAKE=true`, list only trusted automatic actors, and require `factory-ready` for other
authors. For stronger containment, route provider traffic through a vendor-domain allowlist or a credential
broker that exchanges short-lived session material outside the worktree process.

Version, authentication, and model-catalogue health probes use the same provider-specific session boundary but a
disposable empty working directory. They never run from the writable canonical checkout and the directory is
removed immediately after the probe.

## Validation without quota-heavy work

```bash
sudo -u dev /opt/hellotalk-factory/venv/bin/hellotalk-factory providers check
sudo -u dev /opt/hellotalk-factory/venv/bin/hellotalk-factory doctor --online
```

Online doctor also verifies a layered GitHub policy on the configured base branch. A baseline ruleset must require
pull requests and `CI / required`. Independent review must be required by either that ruleset or a review-only
ruleset. The exact repository-owner user may be the sole pull-request-only bypass actor on both rulesets. Factory
automation still requires both statuses and never invokes the manual path. See
[MANUAL-MERGE.md](MANUAL-MERGE.md).

Required context names alone do not prove who published a legacy commit status. Before granting repository write
access beyond the Factory operator, provision a dedicated GitHub App for Factory review attestations and pin each
required context to its expected integration in the ruleset. The current token-based publisher and online doctor
do not yet prove that expected-source binding.

The Factory resets `factory/independent-review` to `PENDING` before every PR-backed AI phase, refresh, or base
update. This is a control-plane invalidation, not a provider result, and it deliberately survives crashes until a
new structured review approves the exact current SHA.

`providers check` is also the service's bounded preflight. It requires no competing legacy executor,
authenticated repository access, and the same merge policy. Zero usable providers is a warning rather than a
startup failure: the daemon remains online, retains durable work, and retries when health or cooldown state
recovers. Detached unrestricted provider processes still fail closed, while a provider attached to an operator
TTY is not classified as an autonomous runtime owner. OpenAI SDK OAuth is also an optional warning when another
configured provider can execute the work.
An activation canary still requires at least one usable provider.

Normal CI uses fake providers and never requires real subscriptions. Optional live smoke tests must be explicitly
gated, harmless, and minimal. Do not launch a full implementation merely to prove that an executable starts.

From `automation/`, run one adapter at a time only after authenticating that same user:

```bash
FACTORY_TEST_CLAUDE=1 uv run --frozen pytest tests/test_agent_cli_integration.py
FACTORY_TEST_CODEX=1 uv run --frozen pytest tests/test_agent_cli_integration.py
FACTORY_TEST_GOOGLE=1 uv run --frozen pytest tests/test_agent_cli_integration.py
FACTORY_TEST_OPENCODE=1 uv run --frozen pytest tests/test_agent_cli_integration.py
```

Each gate performs one tiny no-tools response in a temporary empty directory. All four tests are skipped when
their variable is absent, including in normal CI.

After an auth change, restart the service so cached health and child environment state are rebuilt:

```bash
sudo systemctl restart hellotalk-factory.service
sudo journalctl -u hellotalk-factory.service -n 100 --no-pager
```

If auth fails, leave the job durable, fix the dev session, wait for or clear the normal cooldown by a
successful health check, and resume. Never delete circuit or job state to make a red diagnostic disappear.
