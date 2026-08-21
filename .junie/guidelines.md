# Junie repository guidelines

Junie inherits the central repository rules. Before frontend work, read `AGENTS.md`, `frontend/AGENTS.md`, `DESIGN.md`, `docs/agent-ui-governance.md`, `docs/spartan-relay-architecture.md`, and `docs/claude-design-two-way-sync.md`.

Relay is the application-facing component and visual authority. Spartan owns supported accessible interaction behaviour through the owned Helm layer. Feature code must not bypass that boundary with direct Brain imports or hand-rolled focus, keyboard, overlay, selection, menu, dialog or combobox state where Spartan already owns the capability.

Claude Design is the two-way design-intent/review workspace. Material visual contracts must update repository preview/design-sync metadata and follow the documented design-first, code-first or reconciliation flow.

Preserve semantic Relay tokens, first-class light/dark themes, RTL, i18n, accessibility, high zoom/reflow, reduced motion, forced colours and deliberate responsive layouts. Original product screenshots are reference evidence, not strict styling authority.

Detailed Angular, TypeScript, API, testing and verification requirements remain authoritative in `AGENTS.md` and `frontend/AGENTS.md`. Relevant frontend work must pass `npm run check:spartan-boundaries` and `npm run check:design-sync` in addition to the normal gates.