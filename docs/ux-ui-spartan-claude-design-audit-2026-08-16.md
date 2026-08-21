# UX/UI, Spartan and Claude Design deep audit

Date: 2026-08-16

Status: post-convergence audit against current `main` after the large Spartan/Relay convergence work merged in #7195.

## Executive assessment

The frontend is no longer in an early Spartan adoption phase. The core architecture is established and the main component-system conversion has landed. The current frontend uses Angular 22.1.x, Tailwind CSS 4.3.x, Spartan Brain 1.3.1 and Spartan CLI 1.3.1. `frontend/components.json` points generated/owned Helm components at `src/app/components/ui`, exposes the `@spartan-ng/helm` alias and uses the Nova style.

The repository also has a mature Relay design layer and unusually strong automated design constraints. It checks semantic colour roles, surface elevation, radius hierarchy, spacing density, motion, icons, density modes, RTL logical properties, multilingual typography, forced colours, control-flow syntax, template binding style, Spartan configuration and component-system ownership.

The key conclusion is therefore:

- **Spartan architecture: strong and substantially integrated.** The remaining work is governance, completeness measurement and preventing regression, not initial installation.
- **Relay design-system architecture: strong.** Relay remains the product-facing layer while Spartan owns generic accessible interaction behaviour.
- **UX accessibility foundation: strong.** The repository has explicit contracts for high zoom, forced colours, RTL, multilingual typography, focus and motion.
- **Claude Design workflow: structurally integrated but operational reconciliation is incomplete.** The repository has the correct project mapping, deterministic previews, a two-way-sync policy and CI drift logic, but recorded external reconciliation provenance is still mostly empty.
- **Biggest risk: false confidence.** A rich set of documents and checks can make the system look complete even when actual Claude Design reconciliation or feature-by-feature migration evidence has not been recorded.

## 1. Frontend platform state

The current package configuration confirms:

- Angular `22.1.1` core packages.
- Tailwind CSS `4.3.3`.
- Spartan Brain `^1.3.1`.
- Spartan CLI `^1.3.1`.
- `class-variance-authority`, `clsx` and `tailwind-merge` for variant/class composition.
- `@ng-icons/core` and Lucide for the shared icon contract.
- Cypress visual and end-to-end infrastructure.
- Angular unit tests through the repository `ng test` path.

This resolves the earlier Tailwind 3 blocker documented in the historical redesign audit. Spartan is now technically compatible with the app and is an intentional first-class dependency.

## 2. Spartan adoption state

### What is working well

The architecture now has a clear dependency direction:

`feature surface -> Relay primitive -> owned Spartan Helm -> Spartan Brain`

The contract correctly prevents Brain from becoming an application-level dependency. Feature code owns product behaviour and composition. Relay owns stable product APIs and semantic tokens. Helm owns the styled bridge to Spartan. Brain owns generic accessible interaction state machines.

The current component-system convergence gate already enforces that shared primitives delegate native button, input and textarea interaction to owned Helm controls. This audit strengthens that further by checking every non-Helm application source file and rejecting direct `@spartan-ng/brain` imports outside the owned Helm layer.

That additional rule matters because direct Brain imports in feature code would undermine upgradeability and allow feature surfaces to bypass the stable Relay/Helm boundary.

### Current maturity

The large #7195 merge materially advanced adoption. It introduced owned input and textarea Helm primitives, delegated the principal Relay controls to Helm, migrated a broad set of feature actions, and moved several modal surfaces to Spartan Dialog.

This means a blanket instruction to replace every native HTML element with Spartan would now be counterproductive. Native semantic elements remain appropriate when there is no interactive state machine to outsource. The target should be correct ownership, not a framework-usage percentage for its own sake.

### Remaining risk

The system has historical `components/primitives` compatibility components. Their continued existence is acceptable only while they act as stable Relay wrappers rather than parallel interaction implementations. The component-system gate should continue getting stricter as migrations remove exceptions.

Feature-level raw native controls can also still be legitimate. A native file input, specialised combobox input or semantic form control may need native attributes that a narrow wrapper does not expose. These cases should be treated as explicit boundaries, not automatic migration failures.

## 3. Design tokens and visual consistency

The design foundation is strong. The repository has dedicated automated contracts for:

- semantic colour roles,
- surface elevation,
- radius hierarchy,
- spacing density,
- motion,
- icon use,
- compact/comfortable density modes,
- forced colours,
- multilingual typography,
- RTL logical direction,
- light/dark behaviour.

This is substantially better than relying on a component library alone. Spartan provides accessible component behaviour and a Helm styling layer, but the product identity still comes from Relay semantic roles.

The most important rule to preserve is that Spartan semantic variables are aliases into Relay rather than a second independent colour and spacing system. Product colours, dynamic accent behaviour, theme parity and accessibility constraints must remain Relay-owned.

## 4. UX accessibility and resilience

The frontend engineering rules explicitly require WCAG AA, visible focus, keyboard support, high zoom/reflow, RTL, reduced motion and forced colours. Recent main-branch work also added a dedicated forced-colours contract and bounded dark-theme parity CI.

This is a strong baseline, but accessibility quality should continue to be measured at three levels:

1. primitive semantics and keyboard behaviour,
2. composed feature behaviour and focus order,
3. full-screen reflow, zoom, theme and language states.

A component library cannot guarantee levels 2 and 3 on its own. The design-preview and Cypress paths are therefore important parts of the architecture, not optional screenshot tooling.

## 5. Claude Design two-way sink assessment

The repository has the right conceptual model. Claude Design is not treated as runtime truth or a deployment path. The runtime implementation, Relay tokens, Spartan contracts and tests remain authoritative for shipped behaviour. Claude Design is the editable design-intent and review workspace.

The repository also has a stable `design-sync.manifest.json` bound to the existing **HelloTalk Design System** project with project ID `9bc8b570-f656-4b2e-b23c-bdc776f974b1`.

The manifest currently contains 20 mapped design artefacts. Only one has a non-null `lastReconciledCommit`. That is **1/20, or 5% recorded reconciliation provenance**. Nineteen artefacts are mapped but have no recorded reconciliation commit.

This distinction is critical:

- mapped to Claude Design: yes,
- repository preview exists: intended and machine-verified by the manifest checker,
- two-way reconciliation policy exists: yes,
- external Claude Design reconciliation provenance recorded: mostly no.

Therefore Claude Design cannot yet be described as a fully operational two-way sink across the product. It is a well-designed integration contract with incomplete recorded reconciliation.

## 6. Drift-detection weakness found and fixed

The previous `check-design-sync-drift.mjs` accepted any change to `design-sync.manifest.json` as sufficient when mapped runtime code changed. That meant a PR could modify an unrelated manifest item and satisfy the gate for a different touched visual contract.

This audit closes that loophole.

For every touched design-sync item, CI now requires either:

- its mapped preview to change, or
- that specific item's manifest metadata to change relative to the base commit.

An unrelated manifest edit no longer exempts the changed surface.

This makes the two-way-sync contract enforceable at item granularity.

## 7. Reconciliation provenance validation added

The manifest verifier now validates `lastReconciledCommit` as either:

- `null` while reconciliation is genuinely pending, or
- a full 40-character lowercase Git SHA.

It also reports the exact reconciliation coverage percentage and lists pending artefacts as warnings. Invalid paths, paths escaping the repository and duplicate required-state declarations are rejected.

Pending external reconciliation is not made a hard build failure because Claude Design connectivity is external and the repository explicitly allows runtime testing to continue when that service is unavailable. The important change is that pending work is now visible and measurable rather than silently indistinguishable from completion.

## 8. Measurable system health added

This audit adds `npm run report:ux-system-health`.

The report measures:

- Angular, Tailwind, Spartan Brain and Spartan CLI versions,
- Helm path/alias/style configuration,
- number of owned Helm component directories,
- number of Relay primitive directories,
- direct Brain imports outside Helm,
- design-sync item count,
- reconciled versus pending design-sync items,
- mapped preview presence,
- required governance-file presence,
- Brain ownership percentage,
- Claude Design reconciliation-provenance percentage.

It can print Markdown, print JSON, or write reports with `--write`.

This creates a stable answer to future questions such as "Are we fully on Spartan?" and "Is Claude Design actually synced?" rather than requiring another repository-wide manual search.

## 9. Claude and agent guidance state

The existing `.claude/CLAUDE.md` and `frontend/AGENTS.md` are already strong. They make Spartan the mandatory default for appropriate frontend interactions, require the installed Spartan skill, forbid guessing selectors/APIs, preserve Relay as the product style authority, require accessibility and RTL, and define Claude Design reconciliation as part of material visual work.

The important improvement is not more prose. It is enforcing the guidance in code. The strengthened Brain ownership rule, item-scoped drift detection and reconciliation reporting in this PR turn more of those instructions into executable policy.

## 10. Recommended operating model after this PR

For new UI work:

1. Run the UX system health report and the existing design coverage report when entering a broad UI area.
2. Use an existing Relay primitive first.
3. If reusable accessible behaviour is missing, add or generate the appropriate owned Helm component and wrap it at Relay level when the product needs a stable API.
4. Never import Spartan Brain directly from feature or Relay code.
5. Update affected deterministic design previews for material visual/interaction changes.
6. Update only the affected design-sync manifest items.
7. Reconcile the affected stable IDs with the existing Claude Design project when the external service is available.
8. Record the actual reconciled commit rather than marking the work conceptually complete.
9. Run the component-system, design-sync, visual-contract, frontend lint, build and test gates before merge.

## 11. What not to do

Do not perform a visual rewrite simply to increase Spartan usage. Do not replace semantic native HTML that does not need Brain behaviour. Do not fork Brain. Do not create a second product token system inside Helm. Do not create a second Claude Design project. Do not treat `lastReconciledCommit: null` as proof of sync. Do not accept an unrelated manifest edit as evidence that a changed surface was reconciled.

## Final state after this audit PR

The codebase should be described as **Spartan-first and largely converged, Relay-governed, accessibility-heavy, with strong repository-local visual contracts**.

Claude Design should be described as **properly architected and mapped, but not yet fully reconciled across all mapped artefacts**. The next operational milestone is to drive the recorded Claude Design reconciliation coverage from the current 5% towards 100% as the external design workspace is reconciled against the already-converged runtime surfaces.

This PR deliberately does not fabricate reconciliation commits for artefacts that have not been externally reconciled. It makes the gap explicit, measurable and harder to bypass.
