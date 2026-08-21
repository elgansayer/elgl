# GitHub Copilot repository instructions

Copilot starts from the repository's central engineering and UI guidance. Before frontend work, read `AGENTS.md`, `frontend/AGENTS.md`, `DESIGN.md`, `docs/agent-ui-governance.md`, `docs/spartan-relay-architecture.md`, and `docs/claude-design-two-way-sync.md`.

Relay is the application-facing visual/component authority. Spartan owns supported accessible interaction mechanics through the repository-owned Helm layer. Do not introduce direct Brain imports in feature code when Relay/Helm owns the capability, and do not recreate focus, keyboard, overlay, menu, dialog, selection, tabs, forms or combobox state already provided by Spartan.

Claude Design is the two-way design-intent/review workspace. Material visual or shared interaction-contract changes must update deterministic preview/design-sync metadata and follow the documented design-first, code-first or reconciliation flow.

Preserve semantic tokens, first-class light/dark themes, per-user accent semantics, RTL/logical direction, i18n, keyboard and screen-reader accessibility, high zoom/reflow, reduced motion, forced colours and deliberate responsive layouts. Original product screenshots are reference evidence, not strict styling authority.

Detailed Angular, TypeScript, API, security, testing, and verification guidance lives in `AGENTS.md` and
`frontend/AGENTS.md`. Treat it as strong, editable defaults while continuing to obey mechanically enforced checks
and safety requirements. Do not preserve stale copied audit findings here. Before recurring workflows, use the
current repository skills under `.agents/skills/`, `.claude/skills/`, or other explicitly maintained skill
locations as appropriate.

Relevant frontend work must pass the normal verification gates plus:

```bash
npm run check:spartan-boundaries
npm run check:design-sync
```

After Spartan package/configuration/owned Helm changes, run the Spartan health checks documented in `docs/spartan-upgrade-runbook.md`.
