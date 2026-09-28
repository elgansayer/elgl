# HelloTalk UI Architecture & Interaction Spec

This document describes the product-level screen and interaction architecture. It is not the visual-token or component-implementation authority.

Authoritative design-system sources:

- `DESIGN.md` for product visual direction and Relay semantics.
- `docs/spartan-relay-architecture.md` for component ownership and Spartan boundaries.
- `docs/claude-design-two-way-sync.md` for code ↔ Claude Design reconciliation.
- `design-sync.manifest.json` for stable design artefact identity and provenance.
- `frontend/design-preview/` for deterministic repository-local visual references.

Original HelloTalk screenshots are product-reference evidence only. They may inform useful interaction and information-architecture patterns, but they are not a current palette, token or pixel-parity authority.

## 1. UI philosophy and guidelines

- **Product character:** Mobile-first language exchange and learning, with deliberate tablet and desktop adaptations rather than stretched phone layouts.
- **Visual system:** Use Relay semantic tokens and approved Relay public primitives. Do not prescribe raw product colours in feature architecture.
- **Themes:** Light and dark are first-class. Per-user accent behaviour must preserve semantic contrast and text-on-fill rules.
- **Interaction ownership:** Prefer approved Relay APIs backed by Spartan Helm/Brain for accessible keyboard, focus, overlay, selection and form behaviour. Feature code must not recreate interaction mechanics already owned by Spartan.
- **Claude Design:** Material visual contracts may be explored design-first or code-first, but must be reconciled through the two-way sync contract before completion.
- **Layouts:** Horizontal scrollers, language indicators, sticky navigation and dense social/learning surfaces remain valid product patterns when they fit the feature and accessibility requirements.
- **Accessibility:** WCAG AA minimum, visible focus, keyboard operation, screen-reader semantics, reduced motion, forced-colours support where relevant, and usable 200%/400% zoom and reflow.
- **RTL and globalisation:** Use logical direction properties and translated UI copy. Important state must never depend on colour alone.
- **Reactivity:** Angular Signals and standalone components remain the default implementation model.

## 2. Core screens

### Home and onboarding
- `/home`: landing experience summarising relevant learning and social activity.
- `/onboarding`: multi-step setup for native language, target languages and learner preferences.
- `/proficiency`: diagnostic assessment and proficiency placement.

### Social and discovery
- `/discovery`: partner discovery with intentional filters, profile quality signals and language goals.
- `/moments`: multimodal community timeline.
- `/groups` and `/communities`: directories for language and interest communities.
- `/events` and `/language-parties`: scheduled language events and live sessions.

### Communication
- `/chat`: conversation inbox with unread and live-state signals.
- `/chat/:id`: direct/group messaging with reactions, correction, translation and media tools.
- `/audio-rooms`: LiveKit room discovery and participation.
- `/video-call` and `/active-call`: real-time calling surfaces.

### Learning and immersion
- `/vocabulary`: SRS vocabulary and review workflows. Mastery state must include non-colour cues.
- `/lessons`: structured learning content.
- `/study-buddy`: serious-learning partner matching.

### Profiles and monetisation
- `/profile` and `/profile/:userId`: identity, languages, learning/social signals and relevant activity.
- `/vip` and `/subscription`: subscription and benefit surfaces using locale-aware price formatting.
- `/shop` and `/cart`: virtual goods and purchase workflows.

### Settings and administration
- `/settings`: account, language, accessibility, notification and privacy preferences.
- `/admin`: authorised moderation and operational tooling. Admin UI must use the same Relay/Spartan architecture rather than a separate generic dashboard design system.

The Angular router is the executable authority for exact current route names and lazy-loading boundaries.

## 3. Component architecture

### Relay public primitives

Feature code should consume approved Relay primitives and semantic tokens rather than a historical catalogue of custom `app-*` components. The current public API and migration status are defined by `DESIGN.md`, `frontend/src/app/components/primitives/`, the generated/owned Helm layer under `frontend/src/app/components/ui/`, and the Spartan migration backlog.

Typical capability families include:

- buttons and icon actions,
- cards and semantic surfaces,
- inputs, text areas and form controls,
- chips, badges, tabs and selection controls,
- dialogs, sheets, menus, popovers and tooltips,
- language and proficiency presentation,
- loading, error and empty states,
- navigation and responsive shell primitives.

Where Spartan provides the interaction capability, Relay should own the application-facing presentation/API and Helm/Brain should own the underlying interaction mechanics. Do not bypass that boundary from feature code without a documented migration exception.

### Feature components

Complex feature components remain product-owned compositions. Examples include tokenised reading text, correction/diff experiences, audio-synchronised reading, room participant management and media/celebration overlays. They should compose Relay/Spartan capabilities rather than becoming parallel primitive libraries.

## 4. Interaction catalogue

### Click-to-translate and vocabulary flow
1. The user selects a supported token in reading, chat or community content.
2. Tokenisation uses `Intl.Segmenter` and emits stable token context.
3. The definition experience opens through the approved overlay/sheet primitive and presents translation, definition and pronunciation actions.
4. Saving to vocabulary updates server-backed learning state and exposes a text/icon/semantic cue in addition to colour.

### Chat interactions
- Swipe-to-reply may populate quoted reply context where the input method supports it; equivalent accessible controls must exist.
- Long-press/context actions expose translation, transliteration, copy, report, correction and related actions through Spartan-backed overlay/menu behaviour.
- Hold-to-record must have accessible start/stop alternatives and clear recording state.

### LiveKit audio stage
1. Join with the appropriate publication permission.
2. Request speaking permission.
3. Host reviews the request.
4. Backend issues or updates authorised LiveKit credentials.
5. Client applies the new capability and exposes microphone state clearly.
6. Text chat can remain available alongside the audio session.

### Community correction
1. A learner publishes target-language content.
2. Another user chooses correction.
3. The correction editor opens using approved form and overlay primitives.
4. The correction and optional explanation are submitted through typed backend contracts.
5. The UI presents original and corrected text accessibly without relying only on red/green colour differences.

### VIP and privacy
- Profile-visit behaviour must respect privacy and incognito rules enforced by the backend.
- Paywall and entitlement surfaces use approved Relay/Spartan dialog/sheet primitives and accessible consequence/cost copy.

## 5. Responsive, accessibility and visual-state contract

Material screens and shared primitives should cover the states that apply:

- light and dark themes,
- 390px mobile baseline,
- tablet/desktop layouts where structure changes,
- keyboard focus-visible,
- loading, empty, error and disabled states,
- RTL where directionality matters,
- 200% and 400% zoom/reflow for critical flows,
- reduced motion for animation,
- forced-colours/high-contrast for custom controls.

These states should be represented in tests and repository previews according to `docs/claude-design-two-way-sync.md` and the visual-regression programme.

## 6. Performance and state

- Keep route-level lazy loading and use `@defer` for heavy non-critical content where appropriate.
- Dynamically load substantial optional third-party libraries when that materially improves bundle cost.
- Use Angular Signals for local and shared reactive state according to the engineering constitution.
- Use `NgOptimizedImage` for appropriate static images.
- Track meaningful bundle regressions and justify large dependencies.

Performance optimisations must not bypass Relay/Spartan ownership or degrade accessibility.

## 7. Change protocol

For material UI changes:

1. Check existing issues/PRs and the Spartan migration programme for overlap.
2. Map the feature to Relay public APIs and Spartan capabilities before adding bespoke interaction code.
3. Use semantic tokens rather than hard-coded product colours.
4. Update tests for behaviour and accessibility.
5. Update `frontend/design-preview/` and relevant `design-sync.manifest.json` entries when the visual contract changes.
6. Reconcile with the canonical HelloTalk Design System Claude Design project using the documented design-first, code-first or reconciliation flow.
7. Run the repository verification gates before merge.

A screen is not considered migrated merely because it renders with Tailwind classes. Completion requires consistent Relay presentation, Spartan-owned interaction behaviour where applicable, accessibility, responsive/theme coverage, tests and reconciled design intent.