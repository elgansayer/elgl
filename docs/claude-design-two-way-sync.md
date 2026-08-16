# Claude Design two-way sync contract

Status: authoritative workflow for code ↔ Claude Design reconciliation.

## 1. Purpose

Claude Design is an editable design-intent and review workspace for the HelloTalk Relay design system. It is not a deployment path and it is not a second runtime source of truth.

The shipped source of truth remains:

- Angular runtime code,
- Relay semantic tokens,
- approved Relay primitives,
- Spartan Brain/Helm interaction implementation,
- automated tests and accessibility contracts.

Claude Design is allowed to lead design exploration. Code is allowed to lead implementation-driven visual changes. Both directions must reconcile through this contract.

## 2. Canonical project

Reuse the existing **HelloTalk Design System** Claude Design project. Do not create a second design-system project for migration work.

## 3. Supported flows

### Design-first

1. Run `/design-sync` before starting so Claude Design has the latest repository design system.
2. Create or edit the target with `/design` or Claude Design directly.
3. Record the affected stable design-sync IDs.
4. Review the design against Relay tokens, Spartan capability, accessibility, RTL, multilingual typography and responsive rules.
5. Implement through a normal branch and PR.
6. Update repository previews and sync metadata in the same PR.
7. Reconcile the final implementation back to Claude Design before declaring the visual contract complete.

### Code-first

1. Implement the smallest reviewed runtime change using Relay + Spartan ownership rules.
2. Update repository previews for material visual/interaction changes.
3. Sync the changed design-system subset to Claude Design.
4. Record the last reconciled commit and affected stable IDs.

### Reconciliation

Use reconciliation when both code and design changed since the last sync.

- Never silently pick a winner.
- Compare design intent with shipped behaviour.
- Preserve runtime behaviour, accessibility and product contracts unless the PR explicitly changes them.
- Resolve token/API differences in code first, then refresh the design representation.
- Record the reconciliation commit.

## 4. Conflict policy

A sync conflict exists when both repository code and the mapped Claude Design artefact changed after the last recorded reconciliation.

Automation must stop and request explicit reconciliation rather than overwriting either side.

Priority rules during reconciliation:

1. Security, accessibility and functional behaviour outrank visual convenience.
2. Relay semantic tokens outrank hard-coded values from a design artefact.
3. Spartan interaction contracts outrank hand-authored keyboard/focus behaviour.
4. Approved product behaviour and analytics contracts must not change incidentally.
5. If the design introduces a genuinely new semantic role, add the role to Relay first rather than embedding a one-off value.

## 5. Stable identity and provenance

Every syncable artefact should receive a stable repository-owned ID.

Minimum metadata:

- `id`
- `kind`: `primitive`, `helm`, `screen`, `modal`, `flow`, `foundation`
- repository path(s)
- Claude Design project/path
- owner layer: `relay`, `spartan-helm`, `spartan-brain`, `feature`
- sync direction: `code-first`, `design-first`, `reconcile`
- last reconciled Git commit
- preview path(s)
- required state coverage

The machine-readable manifest is tracked by #7067.

## 6. Required state coverage

For a material visual or interaction contract, include the states that actually apply:

- light theme,
- dark theme,
- 390px mobile baseline,
- wider/tablet or desktop state when layout changes,
- keyboard focus-visible,
- disabled/error/loading/empty states where relevant,
- RTL when directionality matters,
- 200% and 400% zoom/reflow for critical layouts,
- reduced motion for animated interactions,
- forced-colours/high-contrast for custom visual controls.

Do not create meaningless state permutations for non-interactive presentation-only artefacts.

## 7. Claude Design MCP

Claude Code may connect to Claude Design using Anthropic's Claude Design MCP. The canonical user-scoped bootstrap is:

```bash
claude mcp add --scope user --transport http claude-design https://api.anthropic.com/v1/design/mcp
```

Then authenticate from Claude Code with:

```text
/design-login
```

Verify the connection through Claude Code's MCP status before relying on design operations. Do not store OAuth/session credentials in this repository.

Repository policy:

- credentials stay outside the repository,
- no tokens or session data are committed,
- use the canonical Anthropic-hosted endpoint instead of an unofficial proxy,
- lack of Claude Design connectivity must not block ordinary runtime testing,
- `frontend/design-preview/` remains the deterministic repository-local fallback,
- a PR may be marked design-sync-pending only when the external service is unavailable, never as a way to skip the work permanently,
- when connectivity returns, reconcile the pending stable IDs before closing the associated migration work.

## 8. PR requirements

A frontend PR that materially changes a shared visual/interaction contract must state:

- affected design-sync IDs,
- whether it is code-first, design-first or reconciliation,
- preview updates included,
- Claude Design reconciliation status,
- relevant accessibility/responsive states verified.

A PR that changes implementation only with no visual contract effect may explicitly declare `design-sync: not-required` with a short reason.

## 9. Drift detection

CI should eventually fail changed visual-contract code that has neither:

- matching preview/sync metadata updates, nor
- an explicit `design-sync: not-required` declaration.

This is tracked by #7068.

## 10. Completion rule

A visual migration task is not complete merely because the Angular component builds.

It is complete when runtime implementation, tests, repository preview and Claude Design intent are reconciled to the same documented contract, or when the task is explicitly non-visual and exempted.
