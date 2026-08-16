# UX/UI full-tree Spartan audit - 2026-08-16

## Executive conclusion

The application has a strong Spartan/Relay architecture, but it is not yet correct to describe the entire UX as "all Spartan" without qualification.

The owned Helm layer currently contains button, dialog, input and textarea families plus shared utilities. Relay provides a much broader product primitive layer. That is a valid architecture: not every presentation primitive should become a Spartan primitive. Spartan should own interaction semantics where Spartan has an appropriate primitive; Relay should own product semantics and presentation.

The main gap found by this audit is enforcement coverage. The existing Spartan boundary verifier enforces direct Brain ownership across the full tree, but its raw native-button and bespoke interaction checks are changed-file-aware. That allows untouched legacy feature templates to remain outside the owned Helm path without appearing in the normal convergence signal.

## What "complete" means

A complete system does not mean every component imports Spartan directly. The correct target is:

- feature code consumes Relay compositions or owned Helm primitives;
- direct `@spartan-ng/brain` imports exist only inside `frontend/src/app/components/ui`;
- standard native buttons use `hlmBtn`;
- text-like inputs use `hlmInput`;
- textareas use `hlmTextarea`;
- native select is limited to documented platform-semantic boundaries until an approved owned select primitive exists;
- Relay-only presentation primitives do not duplicate keyboard/focus/overlay behaviour already owned by Spartan;
- the full tree, not just changed files, is continuously audited.

## Owned Helm inventory at audit time

- button
- dialog
- input
- textarea
- utils

This is not equivalent to the complete Spartan catalogue. It is the set of Spartan Helm families that the repository currently owns and has generated/implemented.

## Relay primitive inventory

`frontend/src/app/components/primitives` contains a substantially broader catalogue, including product buttons, cards, chips, empty states, fluency/media indicators, inputs, language selection, pills, loading/presentation primitives and other product-specific components.

Those components fall into two categories:

1. interaction wrappers/compositions that must delegate interaction semantics to owned Helm primitives;
2. presentation-only/product-semantic primitives that do not need a Spartan equivalent.

The existence of a Relay primitive therefore is not itself technical debt. Duplication of Spartan-owned interaction behaviour is technical debt.

## Audit gap fixed by this PR

This PR adds `scripts/report-full-tree-spartan-adoption.mjs`.

The scanner inspects every Angular TypeScript/template source file and reports:

- direct Spartan Brain imports outside owned Helm;
- raw native buttons bypassing `hlmBtn`;
- text-like inputs bypassing `hlmInput`;
- textareas bypassing `hlmTextarea`;
- native selects outside the approved select/language-picker platform boundary;
- checkbox/radio usage that represents a future owned-Spartan-family decision;
- `role="button"` interaction surfaces for manual review;
- owned Helm family count versus Relay primitive family count.

`npm run check:spartan-full-tree` runs the scanner in strict mode and is now part of canonical `npm run verify`.

`npm run report:spartan-full-tree` prints the complete inventory without failing.

## Primitive usage audit

This PR also adds `npm run report:relay-primitive-usage`. It inventories component selectors and exported symbols in every Relay primitive family and scans the rest of the Angular tree for external consumers.

A zero-consumer result is a review signal, not automatic proof that the primitive should be deleted: dynamic rendering, public exports and intentionally staged primitives can make a static zero-consumer result legitimate. The report exists to make those cases explicit rather than letting dead or speculative primitives accumulate invisibly.

## Deliberate non-goals

This audit does not hand-author fake Spartan components for APIs that are not generated and verified in the repository. Checkbox, radio, switch, select, combobox, menu and other interaction families should only be added to the owned Helm layer using the supported Spartan generator/API and then migrated with tests.

It also does not turn presentation primitives such as skeletons, indicators or empty-state layouts into meaningless Spartan wrappers. Spartan is an interaction foundation, not a requirement to wrap every DOM node.

## Completion decision

The system can only be described as fully converged when the strict full-tree scanner is green, the existing component-system/Spartan boundary gates are green, and the Claude Design completion gate is green.

Until then, the accurate status is: **Spartan is the canonical interaction architecture and is broadly adopted, but complete full-tree convergence still requires evidence from the strict scanner and any migrations it exposes.**
