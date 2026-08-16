# Active Architecture: The Subscription-First CLI Orchestrator

## Overview

The OpenHands Factory has been fully rewritten into a **Subscription-First CLI Orchestrator**. 
This system deprecates all legacy architecture guarding, raw LLM API keys, and custom LLM inference pipelines in favor of invoking first-party CLI agents (`claude`, `codex`, `gemini`, `opencode`) using the enterprise LLM subscriptions that the organization already pays for.

By orchestrating the native CLI agents, we offload context management, memory, indexing, tool routing, and network proxying directly to the AI providers. 

## 1. Provider Ecosystem & Routing

The factory dynamically routes tasks to the best provider based on their CLI profile using `agents/policy.py` and `config.py`.

- **Claude Code (`claude`)**: Deployed for complex problem solving, architecture design, and refactoring (`Architect`, `Implementation`).
- **OpenAI Codex (`codex`)**: Used for code generation, test creation, and targeted patching.
- **Gemini (`gemini`)**: Employed for PR reviews, validation, and analytics (`Review`).
- **OpenCode (`opencode`)**: Utilized for repository exploration and bug localization.

## 2. Secure Execution via Podman & PTY

Each CLI provider is executed in strict isolation:
- **SandboxRunner**: Ephemeral `localhost/hellotalk-factory-worker:current` podman containers.
- **Network Isolation**: `--network none` ensures agents cannot exfiltrate data, force them to use the factory's tools.
- **PTYWrapper**: A robust pseudo-terminal emulator strips ANSI colour codes, handles interactive TTY prompts (like "Are you sure?"), and prevents agents from hanging indefinitely on unhandled `stdin`.

## 3. Caveman Integration

We employ the **Caveman Local Proxy/CLI Wrap** (`@caveman-ai/cli`) to aggressively shrink tokens across all models.
- **Implementation**: We prepend the `caveman` command in the `SandboxRunner` execution vector (e.g. `caveman claude`).
- **No Gateway Required**: By leveraging the local CLI tools, we bypass the need for a hosted `GATEWAY_URL` or `CAVE_API_KEY`. The local agent directly interfaces with the Caveman CLI engine, preserving 65% of tokens in the shell outputs.

## 4. Self-Healing & the Meta-Agent

The new system employs `meta_agent.py` to ensure high availability:
- **Continuous Monitoring**: Tailing `/var/log/hellotalk-factory.log` to detect tracebacks or catastrophic failures.
- **Autonomous Recovery**: Upon detecting a failure, `meta_agent.py` spawns a high-priority `claude` subprocess to diagnose and patch the underlying bug without human intervention.
- **Resilience**: A fully closed-loop validation pipeline, ensuring "A failing build MUST NOT reach `main`."

## 5. Clean Slate Policy

To reinforce the subscription-first mandate:
- Legacy autonomous executors, swarm endpoints, and unused agent branches have been retired.
- Lingering pull requests related to the legacy pipeline are closed in favor of this single, deterministic CLI wrapper stack.
