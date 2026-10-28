# Diagnostic quiz Relay implementation

Issue: #6125 (`Spartan UI 0343`)

Target: `frontend/src/app/components/diagnostic-quiz`

Status: Relay token, theme and responsive-layout stage complete. The follow-up accessibility/RTL/zoom stage (#6126) and final regression/design-preview stage (#6127) remain separately scoped.

## Outcome

The diagnostic quiz now uses Relay's named product roles for its feature-owned presentation while preserving the Spartan radio-group interaction introduced by #6124 and all existing quiz API/state behavior.

The stage intentionally changes presentation only. It does not change question retrieval, target-language selection, answer identifiers, navigation guards, result submission, CEFR scoring, error recovery, routing, persistence, analytics, or the public `quizCompleted` output.

## Relay ownership

- The quiz container is a standard content card: `bg-surface-200`, `border-surface-100`, `rounded-card`, and `shadow-card`.
- Informational question count uses the semantic `rounded-pill` role rather than a generic capsule radius.
- Progress uses the inset `surface-300` role with the user-owned `primary` accent for completion.
- Answer cards use `surface-300` and `border-surface-100` at rest, then the user-owned `primary` accent for the selected border/background state.
- The footer uses `surface-300` over the standard card surface and `surface-100` as its divider.
- Primary Next/Submit actions remain the default Spartan button treatment. Previous remains the Spartan secondary variant.
- Circular option-number and spinner geometry intentionally retains `rounded-full`; those elements are genuinely circular rather than pill-shaped product containers.

No hardcoded palette colours, generic product shadows, or generic large-radius utilities are introduced.

## Responsive contract

### 390px baseline

- Header title and question counter stack vertically.
- Previous and Next/Submit actions stack and fill the available width.
- Horizontal content padding is reduced to 1rem.
- Answer text can wrap independently of the fixed circular option marker.
- Loading, error and empty states use reduced mobile padding.

### Tablet and desktop

At the `sm` breakpoint and above:

- Header title and question counter return to one row when space allows.
- Footer actions return to an end-to-end horizontal layout.
- Buttons return to content width.
- Card/question padding increases to the established 1.5rem rhythm.
- The existing `max-w-3xl` content cap remains unchanged.

There is no separate tablet-only interaction model; responsive changes are presentation-only.

## Theme and accent behavior

The component uses semantic Relay `surface-*`, `text-*`, `danger`, `primary`, and `on-fill` roles. Light and dark themes therefore resolve through the shared theme token definitions rather than feature-level colour overrides.

The selected answer, progress fill, focus ring, counter tint and primary action continue to follow the current user's primary accent. Text placed directly on the primary fill uses `text-on-fill`.

## Direction and content safety

This stage keeps logical start/end alignment and does not introduce physical left/right positioning. Symmetric padding uses ordinary `px` where direction does not carry meaning. Option content is split into a non-shrinking circular marker and a `min-w-0` text region so long translated or mixed-direction content can wrap without forcing horizontal overflow.

The dedicated #6126 stage remains responsible for the complete keyboard, screen-reader, 200%/400% zoom, reduced-motion and RTL verification matrix.

## Regression coverage

`diagnostic-quiz.component.spec.ts` now locks:

- semantic card surface, border, radius and elevation roles;
- semantic pill treatment for the question counter and progress track;
- semantic answer-card surface/radius treatment;
- mobile-first header/footer stacking with wider-screen restoration;
- full-width mobile actions;
- wrap-safe option layout while preserving genuinely circular markers;
- all pre-existing question loading, selection, navigation, submission, failure and language-reset behavior.

## Verification

The repository CI is the authoritative integration environment for this connector-authored branch. Relevant gates include the frontend unit/static-analysis/build jobs, Relay radius/surface checks, Spartan ownership checks, translation-safe component APIs, UI design coverage and the wider root verification pipeline.

## Rollout and rollback

This is a frontend-only presentation change with no data migration, API version, route change or persisted-state rewrite. It can use the normal frontend deployment path after required checks pass.

Rollback is a direct revert of the #6125 commits. The Spartan radio-group interaction and the server-authoritative diagnostic behavior remain independently intact.
