# Desktop responsive breakpoint verification

Status: verification contract for `[Spartan UI 0048]` / issue #5514.

This gate implements the desktop verification plan defined by `docs/desktop-responsive-breakpoints.md`. It reuses the repository-owned visual contract matrix and deterministic Cypress preview harness rather than introducing a second breakpoint system.

## Contract

The representative Discovery, Chat, Vocabulary, and Moderation previews must retain all of these desktop states:

- 1024px (`lg`) in light theme;
- 1024px (`lg`) in dark theme;
- 1024px (`lg`) in RTL;
- 1024px (`lg`) with 200% root text scaling;
- 1280px (`xl`) in light theme;
- 1280px (`xl`) in dark theme.

The matrix must keep the canonical 1024px desktop boundary and 1280px wide-desktop viewport definitions. Rendered desktop states must not create horizontal document overflow. RTL states must preserve `dir="rtl"`, and the 200% text state must actually enlarge root text.

These exact widths are regression probes, not device categories. Layouts must remain fluid between breakpoints and continue to follow the mobile, tablet, and desktop architecture standards.

## Verification commands

Run the cheap matrix guard from the repository root:

```bash
npm run check:visual-contract-matrix
```

It fails if a required desktop state or fixed verification viewport is removed. A representative failure is:

```text
screen.discovery: desktop responsive gate is missing state: desktop-1024-dark
```

Run the rendered browser gate with:

```bash
cd frontend
npm run visual:capture:ci
```

The Cypress visual-contract suite renders each required desktop state from repository-owned previews. A desktop layout that introduces horizontal page overflow fails with the state name, for example:

```text
desktop-1024-text-200: desktop layout must not create horizontal document overflow
```

## Accessibility and theme coverage

Light and dark states protect theme parity. The RTL state protects logical-direction composition at the desktop boundary. The 200% text state is a deterministic reflow/accessibility signal that catches rigid widths and clipped actions; it is not a substitute for browser zoom testing.

The gate does not change product visuals, tokens, routes, or interaction behavior. It only makes regressions in the existing desktop contract detectable.

## Rollback

Revert the matrix, validator, Cypress state handling, and this document together. Do not remove only the rendered assertions while leaving the required matrix states, or vice versa, because the cheap and rendered halves intentionally form one verification gate.
