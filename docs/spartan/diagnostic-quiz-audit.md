# Diagnostic quiz Spartan / Relay audit

Issue: #6123 (`Spartan UI 0341`)

Target: `frontend/src/app/components/diagnostic-quiz`

Program dependency: #5462 (`Spartan UI 0001`), completed before this audit.

## Scope

This document is the implementation baseline for migrating and maintaining `DiagnosticQuizComponent` under the repository's Spartan Brain / Spartan Helm / Relay architecture.

The audit inventories every interactive control, visible state, async transition, API side effect, route contract, accessibility contract and bespoke presentation utility in the diagnostic quiz. It is intentionally behaviour-neutral. Follow-up conversion work must preserve question loading, answer retention, previous/next navigation, scoring, submission, error recovery and the public `quizCompleted` output while moving reusable interaction and presentation concerns to the approved ownership layer.

The component is already partly converged: all explicit action controls use Spartan Helm `hlmBtn`, product colours are predominantly semantic Relay tokens, spacing uses logical `ps`/`pe` utilities, and the route is standalone/lazy loaded. The largest remaining ownership question is the per-question single-choice answer set, which is visually a set of selectable cards but semantically implemented as independent pressed buttons.

## Discovery summary

The current implementation consists of:

- `diagnostic-quiz.component.ts`, containing the complete inline template, Angular signal/resource state and feature orchestration;
- `diagnostic-quiz.component.spec.ts`, covering loading, success, failure, empty state, navigation, progress, reload, score submission and CEFR calculation;
- `QuizService`, which owns the two quiz HTTP operations;
- the `/diagnostic-quiz` lazy route in `frontend/src/app/app.routes.ts`.

There is no colocated SCSS or HTML file and no component-owned overlay. The surface has no dialog, popover, drawer, menu or tooltip. No explicit analytics hook is present in `DiagnosticQuizComponent` or `QuizService`.

The route contract is:

```text
/diagnostic-quiz
  -> lazy-load DiagnosticQuizComponent
  -> title: Language Level Diagnostic - HelloTalk
```

The path and lazy-loading boundary are contracts to preserve. The route title is currently hard-coded English in
`app.routes.ts`, so it is a known internationalisation defect rather than a string that migration work should
copy. Correct it through the repository's translated route-title pattern when that shared pattern is available.

The component itself never calls `Router.navigate()` and must remain embeddable. Completion is reported to a consumer through `quizCompleted`; route changes, onboarding continuation or profile updates remain consumer responsibilities.

## Public component contract

### Input

`targetLanguage = input<string>('en')`

- defaults to English;
- feeds the resource parameter through `activeLanguage()`;
- can be superseded by the internal `languageOverride` when `reloadQuestions(language)` is called;
- is not presentation state and must not move into a UI primitive.

### Output

`quizCompleted = output<{ score: number; suggestedLevel: string; maxScore: number }>()`

The component emits this output after a completion attempt even when `/api/quiz/results` fails. The failure path shows a translated error toast, clears the submitting state, and still emits the locally calculated result. This is existing product behaviour and must not be changed accidentally by a UI migration.

## Service and side-effect contracts

`QuizService` currently exposes two operations:

| Operation                | Request                                       | Purpose                                                           | UI states affected                                  |
| ------------------------ | --------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| `getQuestions(language)` | `GET /api/quiz/questions?language=<language>` | Load the diagnostic question set                                  | loading, error, empty, quiz content                 |
| `submitResults(results)` | `POST /api/quiz/results`                      | Persist score, maximum score, suggested CEFR level and answer map | submitting, submit failure toast, completion output |

Question loading is owned by Angular `resource()`. Result submission is explicitly awaited by `finishQuiz()`.

The UI migration must not:

- move HTTP calls into Relay or Spartan components;
- duplicate requests through primitive lifecycle callbacks;
- alter the API payload shape;
- expose answer-point values in labels or visual copy unless product requirements explicitly ask for it;
- suppress `quizCompleted` on the current submission-error path without a separate product decision.

## Current state model

### Question resource

The resource has four user-visible outcomes:

1. loading;
2. load failure;
3. loaded with one or more questions;
4. loaded successfully with zero questions.

`reloadQuestions()` resets `currentIndex` and all answers before reloading. When an optional language is supplied, that language becomes the internal override for subsequent resource loads.

### Per-question state

`currentIndex` starts at `0`.

`answers` is a record keyed by question id with the selected option's numeric `points` value. Selection is therefore one value per question. Returning to a previous question preserves its answer because navigation does not clear the record.

`canProceed()` is true only when the current question has an entry in `answers`. `next()` is also guarded in TypeScript, so bypassing a disabled visual control cannot advance an unanswered question.

### Progress state

`progressPercentage()` is calculated as:

```text
currentIndex / questions.length * 100
```

This means the first question reports 0%, and a two-question quiz reports 50% on the final question. The progress bar does not display 100% before completion. That may be intentional "completed questions" semantics rather than "current question" semantics. A migration should preserve it unless product/design explicitly decides otherwise and tests are updated together.

### Submission state

On the last question, `next()` calls `finishQuiz()`.

`finishQuiz()`:

1. sets `isSubmitting` to true;
2. sums selected points;
3. computes `maxScore` as `questions.length * 4`;
4. derives a CEFR suggestion from the percentage;
5. posts results;
6. shows a translated error toast if persistence fails;
7. clears `isSubmitting` in `finally`;
8. emits `quizCompleted` regardless of persistence success.

The score thresholds are:

| Percentage | Suggested level |
| ---------- | --------------- |
| `>= 0.90`  | C2              |
| `>= 0.80`  | C1              |
| `>= 0.60`  | B2              |
| `>= 0.40`  | B1              |
| `>= 0.20`  | A2              |
| otherwise  | A1              |

The hard-coded `4` maximum points per question is a feature/data contract, not UI state. If backend question scoring becomes variable, that calculation needs a separate domain change rather than being folded into the Spartan conversion.

## Complete control and surface inventory

| Element / state          | Current implementation                             | State owner                   | Target owner                                                                         | Migration action                                                        |
| ------------------------ | -------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Loading container        | Native `<div role="status">`                       | Angular resource              | Relay async-state composition                                                        | Preserve semantics; use approved Spinner presentation if available      |
| Loading spinner          | CSS border spinner                                 | Template                      | Relay Spinner / approved loading primitive                                           | Replace bespoke spinner when the repository primitive is available      |
| Load error surface       | Native `<div role="alert">` plus warning emoji     | Angular resource              | Relay error-state composition                                                        | Preserve alert semantics; standardise presentation                      |
| Retry action             | `<button hlmBtn>`                                  | Feature action                | Spartan Helm Button                                                                  | Preserve primitive; use standard button variant/sizing                  |
| Quiz outer surface       | Semantic utility classes                           | Feature composition           | Relay surface/card composition                                                       | Replace bespoke radius/border recipe with approved Relay surface tokens |
| Quiz heading             | Native `h2`                                        | Translation                   | Native semantics + Relay typography                                                  | Preserve                                                                |
| Question counter         | Native `span`, semantic tokens                     | Derived state                 | Relay badge/chip-like presentation if approved                                       | Keep informational, not interactive                                     |
| Progress track           | Native `div role="progressbar"`                    | Derived progress              | Spartan/Relay progress capability if available, otherwise native ARIA + Relay tokens | Preserve value contract; add an accessible name/value text if needed    |
| Progress fill            | Dynamic inline width                               | Derived progress              | Progress primitive presentation                                                      | Preserve derived percentage                                             |
| Question heading         | Native `h3`                                        | API data                      | Native semantics + Relay typography                                                  | Preserve                                                                |
| Answer option set        | Repeated `<button hlmBtn aria-pressed>`            | `answers` signal              | Single-choice primitive if supported; otherwise Helm Button cards + feature state    | Do not invent custom radio keyboard behaviour                           |
| Selected option styling  | Conditional border/shadow/background/token classes | `answers` signal              | Relay selected-state recipe                                                          | Consolidate into approved semantic tokens                               |
| Option number marker     | Native `span` circle                               | Loop index + selected state   | Relay presentation                                                                   | Preserve visual ordering; keep number out of scoring semantics          |
| Previous action          | `<button hlmBtn>`                                  | `currentIndex`                | Spartan Helm Button                                                                  | Preserve; standard secondary/outline presentation                       |
| Next action              | `<button hlmBtn>`                                  | `canProceed` / `currentIndex` | Spartan Helm Button                                                                  | Preserve; standard primary presentation                                 |
| Submit action            | `<button hlmBtn>`                                  | `canProceed` / `isSubmitting` | Spartan Helm Button                                                                  | Preserve; expose busy state consistently                                |
| Submit spinner           | CSS border spinner inside button                   | `isSubmitting`                | Relay/approved Spinner                                                               | Replace bespoke spinner when possible; mark decoration correctly        |
| Footer action bar        | Native flex container                              | Derived state                 | Relay layout composition                                                             | Preserve feature ownership; make mobile/translation-safe                |
| Empty state              | Native `<div role="status">` plus clipboard emoji  | Empty resource result         | Relay Empty State if approved                                                        | Prefer shared empty-state presentation; no Brain behaviour needed       |
| Submission failure toast | `showToast(..., 'error')`                          | Feature orchestration         | Existing toast service / approved toast primitive                                    | Preserve service boundary and translated copy                           |

## Spartan ownership decisions

### Spartan Brain

There are two behaviour patterns worth evaluating against checked-in Brain capabilities.

#### Single-choice answer group

Each question allows exactly one answer. That is conceptually a radio group, even though the current UI renders large selectable buttons with `aria-pressed`.

Preferred target, if the repository's installed Spartan version exposes an approved radio-group capability:

- one labelled group per question;
- exactly one selected option;
- group/value semantics owned by the primitive;
- native/primitive keyboard behaviour rather than hand-authored Arrow-key listeners;
- feature state still stores the selected `points` value keyed by question id;
- the visible option can retain the Relay selectable-card treatment.

Do not import Brain directly into the feature if the repository exposes a Helm or Relay wrapper. If an approved radio-group capability is not checked in, preserving `hlmBtn` + `aria-pressed` is safer than inventing an incomplete radio implementation in this migration. The follow-up implementation should verify package inventory before choosing the transport.

#### Progress

The current progress bar already has correct basic `progressbar` range semantics. If an approved Spartan progress capability exists, it can own the generic progress semantics while the feature continues to compute the value. If not, the native ARIA structure is acceptable and should be retained with Relay presentation tokens.

No other Brain state machine is needed. Loading, errors, empty results and CEFR completion are feature/Relay concerns.

### Spartan Helm

All explicit actions already use `hlmBtn`. That ownership is correct:

- Retry;
- every answer option in the current implementation;
- Previous;
- Next;
- Submit.

The implementation stage should remove bespoke button geometry/colour recipes where Helm variants already provide the desired semantics instead of layering a second button system on top of `hlmBtn`.

Do not replace native headings, status regions or feature API state with arbitrary Helm components merely to increase Spartan usage.

### Relay and application primitives

Relay owns the visual contract around the quiz:

- page/surface background and border treatment;
- typography hierarchy;
- selected/unselected answer-card treatment;
- semantic primary accent;
- muted/supporting text;
- progress colour treatment;
- mobile-first action layout;
- loading, error and empty-state composition;
- light/dark theme parity;
- focus-ring visual integration where Helm does not already own it.

The current component uses semantic classes such as `bg-primary`, `text-on-fill`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `bg-surface-*` and logical `ps`/`pe` spacing. Those are useful foundations and should not be replaced by raw palette classes.

The bespoke `rounded-[2rem]` shell is a concrete Relay-convergence candidate. Use the repository's approved surface/radius token rather than keeping a one-off radius.

## Accessibility audit

### Loading

The loading surface has `role="status"` and a translated accessible label. This is a good baseline.

The spinner itself is purely decorative and should not create duplicate screen-reader output. If the approved spinner primitive does not hide itself automatically, mark the visual spinner `aria-hidden="true"` while retaining the status label on the container.

### Error state

The load failure is correctly exposed as `role="alert"` and includes a real Retry button.

The warning emoji is visual decoration inside the live alert. It should be hidden from assistive technology unless product copy intentionally wants the emoji announced.

### Quiz region and heading

The quiz is a labelled region using a translated `aria-label`. The visible translated title is already an `h2`. A follow-up may prefer `aria-labelledby` linking the region to the visible heading so the accessible name and visible name cannot drift.

### Answer options

Current strengths:

- native `<button>` elements;
- keyboard activation is built in;
- `aria-pressed` reflects selection;
- translated option labels include option number and option text;
- state is not communicated by colour alone because `aria-pressed` carries the selection.

Risks:

- a set of independent pressed buttons does not communicate the single-choice group relationship as clearly as a radio group;
- the question heading is not programmatically tied to an answer-group container;
- focus styling is manually repeated on top of Helm and may diverge from the shared focus contract;
- if the interaction migrates to radio semantics, it must preserve expected Arrow-key and Tab behaviour rather than recreating it partially.

### Progress

The progress element exposes `aria-valuenow`, `aria-valuemin` and `aria-valuemax` but no explicit accessible name or `aria-valuetext`.

The implementation should associate progress with translated copy such as the question counter or a dedicated progress label. Do not announce raw percentage changes so aggressively that every selection/navigation creates disruptive live-region output.

### Previous / Next / Submit

These are native buttons under Helm and therefore retain Space/Enter activation.

Disabled state is reflected with the native `disabled` attribute. Keep disabled semantics in the DOM; visual opacity must not become the only guard.

For submit, add or preserve a meaningful busy contract. The current inline spinner is visible but the control does not expose `aria-busy`. A shared pending-button pattern should own this if available.

### Empty state

The no-questions outcome uses `role="status"` and translated text. The clipboard emoji is decorative and should not be the only indicator of the state.

## Keyboard and input-method contract

The migration must preserve:

- Tab navigation to each actionable control;
- Space/Enter activation on Retry, answer controls, Previous, Next and Submit;
- no navigation past an unanswered current question;
- disabled Previous on the first question;
- disabled Next/Submit until an answer exists;
- disabled Submit while submission is pending;
- visible focus treatment in both themes;
- touch targets of at least the repository's 44px minimum.

If answer options become radio-group based, use the primitive's native keyboard model. Do not add separate `keydown` listeners for Arrow/Home/End unless the primitive contract explicitly requires application wiring.

Pointer, touch and keyboard users must all produce the same `answers` state and completion payload.

## RTL and internationalisation audit

The existing template already uses logical horizontal spacing (`ps-*`, `pe-*`, `me-*`) in the core quiz UI. Preserve this.

No `left-*` / `right-*` positional contract is needed for the surface. Future decorative icons should use logical placement or be direction-neutral.

All product-owned visible UI strings in the current template use translation keys. The route title is a known
hard-coded English exception outside the template. Question and option text come from the quiz API and are
selected by `targetLanguage` / active language.

Migration requirements:

- keep button labels, status copy and accessibility names translation-owned;
- do not concatenate English fragments around translated question counters;
- test long translated headings/options and plural/number expansion;
- allow answer option text to wrap without obscuring the number marker;
- allow header counter and footer actions to wrap/stack at narrow widths;
- preserve logical start alignment for question/answer text in RTL;
- do not assume Latin text metrics in fixed-height containers.

## Responsive and zoom audit

The main surface is bounded by `max-w-3xl`, but several internal layouts assume horizontal room:

- heading + question counter use `flex ... justify-between`;
- Previous + Next/Submit use a single horizontal action row;
- shell padding is a fixed `1.5rem` equivalent on every viewport;
- selected option cards contain an inline option-number marker followed by potentially long text.

Follow-up layout should be mobile first:

- at the 390px baseline, use smaller shell padding where needed and avoid horizontal overflow;
- allow title/counter to wrap or stack without overlap;
- allow navigation actions to stack or use a resilient wrapping layout when translations expand;
- keep primary progression obvious when controls stack;
- preserve at least 44px touch height;
- at 200% and 400% browser zoom, avoid clipped question text, action bars and focus rings;
- tablet and desktop should expand the layout rather than change interaction semantics.

No fixed viewport-height or absolute positioning is currently required, which is a positive baseline for zoom/reflow.

## Theme and token audit

The component is mostly token-driven already. Existing semantic usages include:

- `primary` for progress and selected/primary actions;
- `on-fill` for text/spinners on primary fill;
- `surface-*` for containers, option backgrounds and focus offsets;
- `text-primary`, `text-secondary` and `text-muted` for hierarchy.

No raw hex/rgb product colour is present in the template.

Follow-up work should:

- keep per-user primary accent behaviour by continuing to use semantic `primary` tokens;
- verify text-on-fill contrast for every configured accent in light and dark themes;
- replace one-off radius/elevation recipes with Relay tokens;
- avoid adding `dark:` one-off palette fixes when semantic theme tokens already switch correctly;
- avoid raw Tailwind colour families for error/success/selected states;
- verify selected and unselected options remain distinguishable without relying only on shadow or colour.

The current `shadow-lg` plus `shadow-primary/20` selected treatment is a bespoke elevation recipe and should converge on an approved Relay elevation/selected-state token if one exists.

## Behaviour and navigation contracts to preserve

1. The `/diagnostic-quiz` lazy route continues to render this component.
2. The component itself does not navigate.
3. `targetLanguage` continues to control question loading unless an explicit reload override is set.
4. Retry resets the index and answers before reloading.
5. Selecting a different option for the same question replaces its previous points value.
6. Previous/Next navigation preserves answers.
7. Unanswered questions cannot advance through `next()`.
8. The final Next action becomes Submit.
9. Submission cannot be triggered through the rendered control while already submitting.
10. Local CEFR calculation and output shape remain unchanged.
11. A failed result POST still shows an error toast and emits `quizCompleted` as it does today.
12. No new router, analytics or persistence side effect is introduced by presentation primitives.

## Analytics and privacy

No explicit analytics event is emitted by this component today. Do not add analytics merely as part of UI convergence.

The `answers` record contains assessment choices and the calculated level can be sensitive profile/learning data. Follow-up UI components must not:

- place answer values in DOM data attributes for styling;
- include scores/answers in diagnostic console logging;
- send answer text/points to third-party analytics without an explicit product/privacy requirement;
- leak translated assessment content through generic error reporting.

The existing backend submission remains the intended persistence boundary.

## Existing regression coverage

The colocated Vitest suite currently verifies:

- component creation;
- initial loading state;
- successful question rendering;
- load error state;
- empty question state;
- advancing to the next question;
- TypeScript guard against advancing without selection;
- enabling progression after selection;
- previous navigation and first-question boundary;
- `quizCompleted` emission;
- progress percentage;
- core progressbar range attributes;
- reload/reset behaviour;
- CEFR level calculation;
- graceful result-submission failure.

This is strong domain coverage and should remain authoritative during primitive migration.

## Regression coverage required for implementation

The conversion/regression stages should add focused coverage for:

1. all rendered action controls remain native/Spartan-owned interactive elements;
2. single-choice semantics expose the selected option programmatically;
3. the question owns/labels its answer group if radio-group semantics are introduced;
4. keyboard activation changes exactly one answer;
5. selection survives Previous -> Next round trips;
6. Retry restores first-question, no-answer state;
7. Next/Submit remain natively disabled until allowed;
8. pending Submit exposes a consistent busy state and blocks duplicate activation;
9. loading and empty states have one meaningful status announcement;
10. load errors have one meaningful alert plus a keyboard-operable Retry action;
11. progress has an accessible name as well as min/max/current values;
12. long translated question/counter/action copy wraps without overflow at 390px;
13. the footer remains usable at high zoom;
14. no physical left/right spacing utilities are introduced;
15. light and dark theme states use semantic tokens only;
16. per-user primary accents retain text-on-fill contrast;
17. selected state is perceivable beyond colour alone;
18. no raw palette/hex product colour is introduced;
19. result submission payload remains unchanged;
20. submission failure still emits the existing completion output after the translated toast.
21. the route path remains stable and its title is translated once the shared route-title pattern exists.

## Migration risks

### Changing answer semantics without preserving feature values

A radio-group migration may prefer string option ids while the feature currently stores numeric point values. Do not let primitive value conventions silently change the `answers: Record<string, number>` API payload.

### Double state ownership

Do not maintain an independent primitive-selected value plus `answers` without a clear single source of truth. The feature record should remain authoritative, with the primitive controlled from it or updated through one adapter path.

### Duplicate submission

The visual button is disabled during `isSubmitting`, but the feature method can still be called programmatically. A UI migration must not introduce a second callback path that calls `finishQuiz()` twice.

### Score-model assumptions

The fixed `4` max score per question is outside the UI migration. Avoid "cleaning it up" in the same PR unless the backend schema is intentionally changed and separately tested.

### Progress semantic drift

Changing the visual progress primitive can tempt an implementation to change the formula from completed-question progress to current-question progress. Preserve current values unless a product decision explicitly changes them.

### Lost retry reset

Retry is not just `resource.reload()`: it also resets index and answers. A generic error-state retry wrapper must invoke the feature's `reloadQuestions()` contract rather than reloading the resource directly.

### Submit error semantics

The current component emits completion even when persistence fails. Generic async-action wrappers must not swallow that `finally`/post-error behavior.

### Focus loss between questions

Only the question body changes when advancing. A conversion may need deliberate focus management so keyboard/screen-reader users receive the new question context. Any focus move must be deterministic and tested rather than relying on DOM replacement side effects.

### Long translations

Fixed horizontal header/footer layouts can fail before desktop English does. Responsive changes should be validated with intentionally long translated strings and RTL, not just viewport width.

### Hard-coded route title

The route currently assigns `Language Level Diagnostic - HelloTalk` directly in `app.routes.ts`. Preserve the
route path and lazy-loading boundary, but do not treat that English title as an approved internationalisation
contract. Migrate it through a shared translated route-title mechanism rather than adding a quiz-specific title
workaround.

## Primitive prerequisites

Before implementation, verify the checked-in Spartan version provides the exact supported APIs for:

- Radio Group or equivalent single-choice behavior;
- Progress;
- Spinner/loading treatment.

If a capability is not present, do not import an unapproved package or use direct Brain APIs contrary to the repository ownership map. Preserve accessible native/Helm behavior and open prerequisite primitive work instead.

Relay/application primitives should be preferred for loading, error, empty-state and surface styling when equivalent wrappers already exist.

## Recommended implementation sequence

1. Keep this audit as the behavioral baseline.
2. Verify checked-in Spartan Radio Group, Progress and Spinner inventory.
3. Add/extend regression tests before changing answer semantics.
4. Converge Retry/Previous/Next/Submit onto standard Helm variants and touch sizing.
5. Migrate answer single-choice behavior only if an approved primitive is available.
6. Converge shell, selected-state, progress and async-state visuals onto Relay tokens/primitives.
7. Make header/footer mobile-first and translation-safe at 390px.
8. Add accessible progress naming and pending-submit semantics.
9. Validate RTL, long translations, keyboard-only use, touch, 200%/400% zoom and light/dark themes.
10. Update the mapped Relay + Spartan design preview in the same PR when the visual contract changes.
11. Run the repository's frontend verification and Spartan/design governance gates.

## Design-preview contract

This audit changes documentation only, so it intentionally does not modify `frontend/design-preview/components/component-system.html`.

The implementation ticket will change the visible contract and must update the mapped preview at the same time. Preview coverage should include at least:

- light/mobile question state at the 390px baseline;
- dark/wider question state;
- selected answer state;
- loading state;
- load error + Retry;
- submitting state;
- empty question state;
- long/RTL copy where the preview harness supports it.

## Verification guidance

For the implementation stages, run the actual frontend commands defined by the repository rather than inventing alternate test runners. The expected verification scope includes:

```bash
cd frontend
npm run check:control-flow
npm run check:template-bindings
npm run check:rtl-logical
npm run lint:check
npm run build
npm run test -- --watch=false
```

If the mapped visual contract changes, also run the root design-sync check and the repository's visual-capture
workflow.

This audit itself is documentation-only and does not alter Angular runtime behavior, API calls, routes, tests or the design-preview visual contract.

## Audit conclusion

`DiagnosticQuizComponent` already has a solid standalone signal/resource model, strong domain tests, semantic Relay colour foundations, RTL-safe logical spacing and Spartan Helm ownership for explicit actions. The migration should therefore be incremental rather than a rewrite.

The primary behavioral decision is the single-choice answer set: prefer an approved Spartan radio-group path if the checked-in package supports it, but do not replace working accessible Helm buttons with a bespoke pseudo-radio implementation. Relay should own the surface, async-state, selected-state and responsive visual recipes, while the feature continues to own question loading, answer points, navigation, scoring, result persistence and completion output.

The highest-risk regressions are changing answer payload values, losing Retry's reset semantics, changing the progress formula, altering completion-on-submit-failure behavior, and breaking narrow/translated layouts. Those contracts should be locked by regression tests before the visual/primitive conversion begins.
