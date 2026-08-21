# Cross-agent UI governance

This file provides common frontend design-system guidance for every coding agent and editor integration used in
this repository. It is a living document and can be updated as the product and toolchain evolve.

## Guidance order

For frontend UI work, agents should begin with:

1. `AGENTS.md` - living repository-wide engineering guidelines.
2. `frontend/AGENTS.md` - frontend-specific Angular and Spartan guidance.
3. `DESIGN.md` - Relay visual language, semantic tokens and product design direction.
4. `docs/spartan-relay-architecture.md` - Relay/Helm/Brain ownership boundaries.
5. `docs/claude-design-two-way-sync.md` - code-first, design-first and reconciliation workflow.
6. `design-sync.manifest.json` - stable design artefact identity and provenance.

Tool-specific instruction files may add operational hints. When guidance conflicts, use the current task,
mechanically enforced checks, safety requirements, and evidence-based engineering judgement, then update the
living documents when a persistent clarification is useful.

## UI ownership contract

- Relay is the application-facing component and visual design layer.
- Spartan Brain owns supported accessible interaction mechanics.
- Repository-owned Spartan Helm code under `frontend/src/app/components/ui` is the implementation/styling boundary.
- Feature code should consume Relay/Helm APIs and must not import Brain directly when the capability is already owned by the UI layer.
- Do not create a parallel library of bespoke `app-*` controls or recreate focus, keyboard, overlay, selection, combobox, tab, menu, dialog or form interaction state that Spartan already provides.
- Use semantic Relay tokens instead of hard-coded product colours where a semantic role exists.

## Claude Design two-way sink/source

The canonical **HelloTalk Design System** Claude Design project is the editable design-intent and review workspace.

Material visual or interaction-contract changes must use one of the documented flows:

- design-first: sync repository state, explore/change in Claude Design, implement, then reconcile;
- code-first: implement through Relay/Spartan, update deterministic previews/metadata, then sync/reconcile;
- reconciliation: compare both sides and resolve deliberately when code and design changed independently.

Claude Design is not a deployment source of truth. Shipped Angular code, Relay tokens, Spartan interaction contracts, tests and accessibility requirements remain runtime authority.

## Visual and accessibility invariants

All agents must preserve:

- first-class light and dark themes;
- per-user primary accent semantics and correct text-on-fill contrast;
- RTL/logical direction support;
- translated user-facing strings;
- keyboard operation and visible focus;
- screen-reader semantics;
- 200% and 400% zoom/reflow on critical flows;
- reduced motion where animation exists;
- forced-colours/high-contrast support where custom controls require it;
- state cues that do not rely on colour alone;
- intentional mobile, tablet and desktop layouts.

Original HelloTalk screenshots are product-reference evidence, not a strict-dark, neon, raw-colour or pixel-parity authority.

## Required checks

For relevant frontend work, run the repository gates, including:

```bash
npm run check:spartan-boundaries
npm run check:design-sync
```

Run the Spartan health workflow/commands after Spartan package, configuration or owned Helm changes. Material visual changes must update the mapped repository preview/design-sync metadata and be reconciled with Claude Design.

## Agent fallback guidance

Fallback agents such as Gemini, Junie, Windsurf, Cursor, Copilot, or other coding assistants start from the same
Relay, Spartan, and Claude Design guidance. If a tool-specific file conflicts with these defaults, resolve the
conflict using current task needs, safety, repository checks, and available evidence rather than treating either
document as immutable.
