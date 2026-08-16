# HelloTalk AI Clone

A HelloTalk-inspired social language-exchange platform with real-time messaging, LiveKit audio/video rooms, native-speaker corrections, interactive reading, vocabulary learning, moderation tooling, and a dedicated administration application.

The repository is a multi-application workspace:

- `frontend/` — Angular 22 consumer application using the repository-owned Spartan UI/design-system conventions.
- `backend/` — NestJS API and domain services.
- `admin-portal/` — separate Angular administration application backed only by server-authorized admin APIs.
- `supabase/` — PostgreSQL/Supabase schema and migrations.
- `automation/` — the bounded OpenHands Factory used for supervised autonomous engineering on the VPS.

## Authoritative documentation

`README.md` is intentionally an index rather than a duplicate specification. The canonical sources are:

- [`AGENTS.md`](AGENTS.md) — engineering constitution, safety rules and contribution requirements.
- [`FEATURES_SPEC.md`](FEATURES_SPEC.md) — product capability inventory.
- [`SPEC.md`](SPEC.md) — platform/data architecture.
- [`DESIGN.md`](DESIGN.md) — product and design-system decisions.
- [`ui_architecture.md`](ui_architecture.md) — Angular, Spartan UI, accessibility and UI architecture.
- [`docs/factory/README.md`](docs/factory/README.md) — Factory deployment and operations.
- [`docs/architecture/REPOSITORY_SOURCES_OF_TRUTH.md`](docs/architecture/REPOSITORY_SOURCES_OF_TRUTH.md) — ownership of canonical, generated, provider-specific and runtime artifacts.

The generated [`wiki/`](wiki/) is useful for navigation and reporting, but it is derived material and does not override the sources above.

## Platform architecture

The primary stack is:

- Angular 22 standalone components and signals
- Spartan UI conventions and repository-owned semantic design tokens
- NestJS
- Supabase/PostgreSQL with PostGIS
- Redis
- Centrifugo for real-time messaging/presence
- LiveKit for audio/video
- Cloudflare R2/S3-compatible object storage
- Prometheus/Grafana observability

The backend applies a global `/api` prefix. The base and development Docker Compose files include the API, web frontend, Redis, Centrifugo, LiveKit, Prometheus and Grafana services.

## Development

Use Node.js 22+ and npm 10+.

```bash
npm ci
npm run verify
```

The root verification gate checks the consumer frontend, backend, administration application, repository governance, critical product contracts and the UI/design-system contracts. The Factory Python package has its own `uv`-managed lint, type-check and pytest gate in canonical CI.

For the containerized development stack:

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up
```

For the production-style local stack:

```bash
cp .env.example .env
docker compose up -d
```

## UI and administration

The consumer frontend owns the primary Spartan UI/component-system implementation and the semantic visual contracts. The standalone admin portal follows the same accessibility, logical-direction, focus, reduced-motion, forced-colour, density, typography, spacing and surface rules rather than introducing a parallel visual language.

Administration security is server authoritative. Angular route/capability guards improve UX but are never the security boundary. NestJS admin controllers require authenticated admin context and explicit capabilities; administrative mutations are rate-limited and durably audited.

## Critical product verification

`config/critical-product-contracts.json` defines machine-checked cross-application contracts for the admin portal and anchors for critical authentication, user/profile, audio-room, moderation and administration journeys. Canonical CI also runs backend E2E tests and browser-level frontend regression coverage.

## Advanced AI Factory tooling

The repository contains the **bounded OpenHands Factory** under `automation/`. It is the active autonomous coding control plane for the VPS; the retired swarm architecture must not be reintroduced.

The default production execution path is:

1. OpenHands owns one bounded coding conversation inside an isolated rootless Podman worktree.
2. OpenAI **Codex subscription OAuth** is the primary LLM provider inside OpenHands.
3. **OpenCode Go** is an optional fallback when its key and model are both configured.
4. Gemini configuration is retained only for migration/diagnostic compatibility and cannot be enabled as a production Factory LLM tier.
5. An optional outer phase-specific `AgentRouter` exists for deliberately configured CLI providers; it is disabled by default and is separate from the retired swarm.

The Factory records provider provenance, uses health/circuit-breaker state, performs bounded failover for provider failures, keeps task failures separate from provider failures, verifies changes before PR creation, independently reviews work where provider diversity is available, and preserves reviewed-SHA/required-check merge safety.

Operational recovery commands, authentication layout, budgets, security boundaries and deployment details live in the [Factory runbook](docs/factory/README.md).

## Repository governance

Tool-specific directories such as `.claude/`, `.cursor/`, `.gemini/`, `.junie/`, `.windsurf/`, `.jules/`, `.Jules/`, `.agents/` and `.mcp/` are adapters for external tools. They do not form independent sources of engineering truth. Runtime output such as test results, coverage, Factory state and logs must not be committed.

Changes that materially affect architecture should update executable code/tests first, then the canonical document for that domain, then any provider-specific adapters or generated documentation that depend on it.
