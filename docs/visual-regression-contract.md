# Visual regression contract

Status: capture/state-matrix foundation for #7078.

## Purpose

Visual verification complements functional and accessibility tests by catching layout, typography, token, spacing and presentation regressions that DOM assertions can miss.

The repository uses `design-sync.manifest.json` as the stable identity layer and `visual-contract.matrix.json` as the visual-state verification layer. Visual contracts test Relay/public product surfaces and deterministic repository previews rather than private Spartan Brain implementation details.

## Current automated capture layer

`npm run check:visual-contract-matrix` validates that representative contracts:

- have a corresponding design-sync ID,
- use the same repository preview path as the design-sync manifest,
- include every state required by that manifest item,
- retain required representatives for forms/buttons, overlays, discovery, chat, vocabulary and moderation,
- retain the fixed 768px and 1024px tablet verification viewports,
- retain the required tablet light, dark, RTL and text-scale states on representative product screens.

`cd frontend && npm run visual:capture:ci` starts a dependency-free static repository preview server and runs an isolated Cypress configuration. It captures the deterministic states Cypress can express reliably today:

- light,
- dark,
- 390px mobile,
- 768px tablet in light and dark themes,
- 768px tablet in RTL,
- 768px tablet with 200% root text scale,
- 1024px tablet/desktop-boundary width in light and dark themes,
- wide desktop,
- RTL.

The capture suite disables CSS transitions/animations and waits for document fonts before taking screenshots. Tablet states also fail the Cypress run if the document develops horizontal overflow. The 200% root text-scale state is a deterministic reflow signal; it is not represented as browser zoom.

## Tablet responsive migration gate

The tablet gate is intentionally split into a cheap contract check and a rendered browser check.

Run the cheap matrix check from the repository root:

```bash
npm run check:visual-contract-matrix
```

This fails when a representative screen drops any required tablet state or when the canonical 768px/1024px viewport definitions drift. The failure is explicit, for example:

```text
screen.discovery: tablet responsive gate is missing state: tablet-768-dark
```

Run the rendered gate with:

```bash
cd frontend
npm run visual:capture:ci
```

For the representative discovery, chat, vocabulary and moderation previews, Cypress renders the 768px `md` composition and the 1024px `lg` boundary in both light and dark themes. It also exercises RTL and 200% text scaling at 768px. A layout that creates horizontal document overflow fails with an assertion containing the state name, for example:

```text
tablet-768-text-200: tablet layout must not create horizontal document overflow
```

These states are migration guards, not permission to optimize only for two exact widths. Feature and Relay layouts must remain fluid between breakpoints and continue to follow the repository responsive architecture.

## States not yet treated as pixel baselines

The matrix also records states such as focus-visible, keyboard, disabled, error, loading, empty, reduced motion, forced colours and 400% zoom where they are contractually required. These remain explicit coverage obligations even when the current capture harness cannot yet represent them faithfully as a pixel baseline.

Do not fake browser forced-colours or browser zoom with an arbitrary CSS class/transform just to mark a state automated. Functional/accessibility checks remain authoritative until a deterministic browser-level representation is added.

## Baseline policy

Cypress's built-in screenshot command is used only for deterministic capture and CI artefacts. It does not compare images. A capture becoming available in CI must never be described as a passing visual-regression comparison by itself.

The next #7078 stage is to add a reviewed image-comparison baseline mechanism. Baseline updates must be explicit PR changes or an equivalent review/approval action. CI must never silently rewrite/accept baselines.

## Anti-flake rules

Visual captures must:

- render from repository-owned static previews rather than live APIs;
- use a fixed browser and viewport;
- disable animations/transitions/timers that change pixels;
- wait for fonts and required content before capture;
- avoid current time, random values, live account data and third-party widgets;
- mask only genuinely uncontrollable dynamic regions rather than increasing global diff tolerance;
- prefer focused primitive/surface captures over enormous whole-application snapshots when a smaller contract is sufficient.

## CI artefacts

The visual-capture workflow uploads screenshots whether the capture job passes or fails. When a pixel comparator is introduced, diff output must be uploaded separately so reviewers can inspect expected/current/difference images.

## Relationship to Claude Design

Every contract uses the same `designSyncId` as the code ↔ Claude Design manifest. This means one stable identity can answer:

- where the runtime implementation lives,
- where its deterministic preview lives,
- what states must be represented,
- where its Claude Design counterpart lives,
- whether code/design reconciliation is current,
- which visual captures belong to the contract.

A visual contract is therefore part of the same two-way design pipeline rather than a parallel screenshot system.
