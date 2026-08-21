# Final Claude Design reconciliation execution

Canonical project: **HelloTalk Design System**

Project ID: `9bc8b570-f656-4b2e-b23c-bdc776f974b1`

This is the final external step for the UX/UI + Spartan + Claude Design convergence programme.

## Execution

From an authenticated Claude Code environment with the canonical Claude Design MCP connected:

1. Run `/design-login` if authentication is not active.
2. Run `/design-sync` against the repository at the exact commit being reconciled.
3. Run `npm run report:claude-design-reconciliation -- --json` and process every pending item.
4. For each item, compare the runtime implementation and repository preview with its `claudeDesignPath`.
5. Reconcile all required light, dark, responsive, RTL, accessibility and motion states listed in `requiredStates`.
6. Where Claude Design differs from runtime, resolve according to `docs/claude-design-two-way-sync.md`: accessibility, behaviour, Relay semantics and Spartan interaction contracts take precedence over visual convenience.
7. After successful external reconciliation, set that item's `lastReconciledCommit` to the exact Git commit whose runtime/preview state was reconciled.
8. Do not bulk-fill SHAs before the corresponding external artefact has actually been checked.
9. Run `npm run check:ux-100-percent`.
10. Only when it passes may the programme be declared 100% complete.

## Current known external queue

At the start of this final convergence branch, 19 of the 20 manifest entries have `lastReconciledCommit: null`. `spartan.overlays-menus` is the one existing entry with recorded reconciliation provenance.

The queue is generated from the manifest rather than duplicated here so it cannot silently drift:

```bash
npm run report:claude-design-reconciliation
```

## Failure policy

If the Claude Design MCP or authentication is unavailable, leave pending items unresolved. Repository previews and CI may continue to improve, but they do not replace external reconciliation and the programme must remain below 100%.
