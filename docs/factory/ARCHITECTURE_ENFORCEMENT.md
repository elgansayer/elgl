# Factory Architecture Enforcement

`docs/factory/ACTIVE_ARCHITECTURE.md` is an executable contract, not historical guidance. The Factory CI suite contains architecture-invariant tests that fail when critical defaults or security boundaries drift.

The enforced production architecture is:

1. one OpenHands Factory daemon on the VPS;
2. Codex through OpenAI/ChatGPT subscription OAuth as the primary provider;
3. OpenCode Go as the default fallback provider;
4. Gemini disabled unless an operator deliberately opts in;
5. one stable provider for the lifetime of each OpenHands conversation;
6. implementation, security review, quality repair, CI repair and independent review all remain phases of the same Factory rather than separate legacy daemons.

CI verifies that the environment template agrees with provider defaults, SDK `FallbackStrategy` is not reintroduced, the reserved provider is explicitly handed to `build_llm()`, worker terminal environments do not inherit controller secrets, the protected base branch cannot be pushed directly, known retired swarm entrypoints do not reappear under active automation, and independent review retains provider-diversity support.

Historical incident reports may mention Aider, the swarm, guardians, resolvers or old reviewers. Those references are documentation only. Reintroducing executable entrypoints beneath active automation is architecture drift.

Changes to provider order, authentication, worker isolation, merge authority or durable-state ownership must update the corresponding Factory architecture documentation and tests in the same pull request. Major dependency upgrades that alter any of those contracts require migration-specific acceptance criteria before autonomous merge.
