# Gemini repository instructions

Gemini must follow the repository's central engineering instructions rather than maintaining an independent frontend architecture.

## Required authorities

Before frontend work, read:

- `AGENTS.md`
- `frontend/AGENTS.md`
- `DESIGN.md`
- `docs/agent-ui-governance.md`
- `docs/spartan-relay-architecture.md`
- `docs/claude-design-two-way-sync.md`
- `design-sync.manifest.json` when a visual contract is involved

## UI contract

- Relay is the application-facing visual/component authority.
- Spartan owns supported accessible interaction mechanics. Use the owned Helm layer and approved Relay APIs rather than importing Brain directly from feature code.
- Do not create a parallel bespoke primitive library or recreate focus, keyboard, overlay, menu, dialog, selection or combobox behaviour already owned by Spartan.
- Claude Design is the two-way design-intent/review workspace. Material visual changes must follow the documented design-first, code-first or reconciliation flow and update deterministic preview/design-sync metadata.
- Preserve semantic tokens, first-class light/dark themes, RTL, i18n, accessibility, high zoom/reflow, reduced motion, forced-colours support and intentional responsive layouts.
- Original product screenshots are reference evidence, not styling authority.

## Angular and TypeScript

The detailed Angular, TypeScript, testing, API-first, British English, i18n and repository verification rules live in `AGENTS.md` and `frontend/AGENTS.md`. Those files are authoritative and must be consulted rather than duplicated here.

For relevant frontend changes, run the standard frontend gates plus:

```bash
npm run check:spartan-boundaries
npm run check:design-sync
```

After Spartan package/configuration/owned Helm changes, also run the Spartan health checks documented in `docs/spartan-upgrade-runbook.md`.