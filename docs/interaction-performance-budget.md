# Interaction performance budget

Status: authoritative implementation contract for the Relay + Spartan UI migration.

This document defines the repository-wide interaction performance contract for the Angular product UI. It supplements `DESIGN.md`, `docs/spartan-relay-architecture.md`, the responsive and zoom standards under `docs/`, and the repository performance automation. It does not create a second component system, a performance-only UI mode, or a license to trade accessibility and correctness for benchmark scores.

## 1. Scope

The interaction performance budget applies to every user-facing Angular route, reusable Relay primitive, Spartan composition, form, overlay, list, feed, chat surface, learning interaction, media control, admin interaction, and realtime update that can affect input responsiveness.

The contract covers:

- pointer, touch, keyboard, stylus, and assistive-technology-triggered actions;
- typing, IME composition, selection, drag, seek, scroll, and gesture handling;
- route and tab changes initiated by a user;
- dialogs, sheets, menus, popovers, comboboxes, and other overlays;
- list, feed, chat, search, filtering, sorting, and virtualised rendering;
- optimistic and authoritative mutation feedback;
- realtime updates arriving while the user is interacting;
- synchronous JavaScript, rendering, style, layout, paint, and animation cost;
- light and dark themes, per-user primary accents, RTL, long translations, and complex scripts;
- 390px mobile, tablet, desktop, 200 percent zoom, and 400 percent zoom compositions;
- reduced motion and high contrast;
- SSR and hydration hand-off where it affects first interaction readiness.

Network latency and server processing have separate budgets, but the UI must remain responsive and truthful while those operations are pending.

## 2. Current implementation audit

The repository already has useful performance foundations:

- Angular production builds enforce an initial bundle warning at 2.5 MB and error at 3 MB, plus per-component style budgets in `frontend/angular.json`.
- The frontend is standalone and route-heavy surfaces use lazy loading rather than one eager feature bundle.
- Relay defines bounded motion durations: fast 140 ms, base 180 ms, and slow 260 ms.
- The 390px, tablet, desktop, 200 percent zoom, and 400 percent zoom standards already require responsive reflow rather than duplicated layout trees.
- The repository performance automation asks for a 60 FPS mobile target, production build statistics, bundle inspection, lazy loading for heavy dependencies, and virtualisation for long content.
- Spartan Brain/Helm owns generic keyboard, focus, selection, and overlay mechanics so feature components do not need to reproduce those state machines.
- Existing frontend verification already checks production build, static analysis, visual contracts, RTL-safe layout, reduced motion, design-system ownership, and route-level E2E boundaries.

The current gap is that bundle size and visual correctness do not define an interaction budget. There is no single repository contract that says how quickly an interaction must acknowledge input, how much synchronous main-thread work is acceptable, how long tasks are handled, when large collections must be bounded, or how regressions should be measured.

A 60 FPS aspiration by itself is also insufficient. A UI can animate at 60 FPS while an input handler blocks for hundreds of milliseconds before the animation starts. Conversely, an occasional missed frame does not necessarily make an interaction unusable. The repository therefore needs both user-centric latency targets and lower-level guardrails.

## 3. Performance principles

### 3.1 Correctness and accessibility are hard constraints

A performance change must not:

- skip required validation or authorization;
- show success before authoritative state permits it;
- remove accessible names, descriptions, status, or focus behavior;
- replace semantic controls with faster but non-semantic click targets;
- drop translated or user-authored content merely to reduce rendering work;
- disable RTL, high zoom, high contrast, or reduced-motion behavior;
- weaken input sanitisation, privacy, or security boundaries;
- remove loading, unavailable, retry, or error states that explain real latency.

When a performance goal conflicts with correctness or accessibility, fix the architecture rather than weakening the product contract.

### 3.2 Measure user-visible interactions

The primary question is whether the user can begin an action and receive the next useful visual response promptly.

Measure interactions such as:

- opening a menu, dialog, picker, or detail surface;
- pressing Send, Save, Follow, Like, Retry, or Grade;
- switching a discovery filter or tab;
- typing and composing text;
- scrolling a long conversation or feed;
- selecting an SRS answer;
- seeking or changing playback speed;
- opening a profile or navigating to another route.

Do not optimise only synthetic loops that users never execute.

### 3.3 Bound work before optimising it

The preferred order is:

1. bound the amount of work;
2. avoid doing unnecessary work;
3. move work away from the critical interaction path;
4. split or yield long work;
5. cache or precompute only where ownership and invalidation are explicit;
6. optimise algorithms and rendering after measurement.

An O(n) loop over a deliberately bounded 20-item list can be better than a complex cache that must remain coherent across thousands of records.

## 4. User-centric latency budget

### 4.1 Field target: Interaction to Next Paint

For real-user monitoring when privacy-approved telemetry exists, product surfaces should target:

- **good:** INP at or below 200 ms at the 75th percentile;
- **needs improvement:** above 200 ms and at or below 500 ms;
- **poor:** above 500 ms.

These thresholds follow the current Core Web Vitals definition. They are a field-health target, not a reason to collect raw input values, message text, route parameters containing private data, or user identifiers.

The p75 should be evaluated across a representative mobile cohort and separately for materially different application surfaces when enough samples exist. A global average must not hide a slow chat composer or learning interaction.

### 4.2 Immediate acknowledgement

For an interaction that cannot complete immediately because it requires network, media, or provider work:

- acknowledge the action visually within 100 ms where practical;
- expose pending/busy state without waiting for the network response;
- keep the control's accessible name understandable while pending;
- prevent duplicate submission when replay is unsafe;
- never invent completion progress or success.

Acknowledgement can be a pressed state, pending label, progress indicator, optimistic state that is explicitly safe, or a disabled/busy transition. It is not a fabricated server result.

### 4.3 Local UI interactions

Local actions such as opening a menu, toggling an already-loaded setting, expanding a disclosure, or moving selection should normally produce the next meaningful paint within 100 ms on the representative test profile.

If a local interaction regularly exceeds 100 ms, investigate synchronous JavaScript, forced layout, excessive DOM, change-detection breadth, image decode, font work, or third-party code before increasing the budget.

## 5. Main-thread execution budget

### 5.1 Long tasks

A task that occupies the main thread for more than 50 ms is a long task and must not be a normal consequence of routine input.

During a representative interaction trace:

- no feature-owned synchronous handler should intentionally execute one unbroken task above 50 ms;
- repeated long tasks caused by one user action are a release blocker for that interaction until reviewed;
- background processing that can exceed 50 ms must yield, chunk, move to a worker, or run outside the critical interaction path.

Third-party long tasks still count against the user experience. Owning the package indirectly does not exempt the cost.

### 5.2 Frame work

For continuous interactions such as scrolling, dragging, drawing, waveform seeking, or animated transitions:

- target one visual update per display frame where the browser can sustain it;
- at 60 Hz, keep feature-owned JavaScript for an individual frame comfortably below the 16.7 ms frame interval;
- prefer an approximately 8 ms feature-JavaScript target for continuously repeated frame work so style, layout, paint, browser work, and other application activity retain headroom;
- use `requestAnimationFrame` for visual frame scheduling rather than unbounded pointer or scroll callback redraws.

Do not claim every device must render exactly 60 frames per second. The invariant is that repository code does not monopolise the frame budget or accumulate an ever-growing input backlog.

### 5.3 Yielding

Large client-side work should be structured so cancellation and newer intent can win.

Examples:

- split large transforms into bounded chunks;
- cancel or supersede stale searches and filters;
- schedule non-urgent follow-up work after the interaction-critical paint;
- use a Web Worker for CPU-heavy pure computation only when measurement justifies the transfer and serialization cost;
- preserve deterministic server/client results when moving work across SSR/browser boundaries.

Avoid a chain of zero-delay timers that merely hides one long task as many near-long tasks while keeping the main thread continuously busy.

## 6. Input-specific contracts

### 6.1 Typing and IME composition

Text entry is latency-sensitive.

Feature code must:

- preserve native text editing and IME composition;
- not send network requests on every raw keystroke without a bounded, cancellable policy;
- avoid rebuilding large unrelated component trees on each character;
- avoid synchronous full-history search, diff, tokenisation, or serialization in the input event when that work is not required for the next paint;
- respect `KeyboardEvent.isComposing` and composition lifecycle where Enter or shortcuts have product meaning;
- keep suggestion/autocomplete results cancellable so stale responses cannot replace newer text.

Debounce is appropriate for remote search or expensive derived work. It is not appropriate for hiding a slow local text update.

### 6.2 Pointer and touch

Pointer/touch handlers must:

- use Pointer Events when one input model can cover mouse, touch, and pen;
- avoid layout reads and writes in alternating loops;
- use passive listeners for wheel/touch scrolling when `preventDefault()` is not required;
- use pointer capture for bounded gestures where appropriate;
- batch drawing or drag rendering to animation frames;
- cancel gesture state deterministically on pointer/touch cancellation and component teardown.

### 6.3 Keyboard

Keyboard interaction must not be slower because it follows an alternative code path.

Native buttons, links, form controls, and Spartan Brain state machines should remain the first choice. Feature code must not implement separate expensive Enter/Space emulation for controls already available as native or Spartan primitives.

## 7. Rendering and DOM budget

### 7.1 Bound collection rendering

Do not render an unbounded server collection into the DOM.

Every list/feed/chat/table surface must have one of:

- a bounded page size;
- cursor/page pagination;
- incremental loading with an explicit retained bound;
- virtualisation/windowing where the product requires a very long in-memory collection.

The choice is product-specific. Virtualisation is not mandatory for a 20-item list and pagination is not a substitute for chat scroll anchoring where older history is intentionally loaded.

### 7.2 Stable identity

Repeated records must have stable product identity so Angular can preserve DOM/state instead of recreating the collection unnecessarily.

Use stable IDs for chat messages, users, flashcards, notifications, events, rooms, and other records. Do not use an array index as durable identity when insertions/reordering can occur.

### 7.3 Derived values

Expensive derived data should be memoised through Angular signals/computed state or an appropriate store boundary when its dependencies are explicit.

Do not put expensive function calls in templates when they recompute for every change-detection pass. A tiny formatting helper over a small bounded value is not automatically a problem; use measurement and code clarity together.

### 7.4 Images and media

Interaction-critical surfaces must not synchronously decode unnecessarily large media to acknowledge an action.

Use the shared media platform for appropriate thumbnails/derivatives, preserve intrinsic dimensions to reduce layout shifts, lazy-load off-screen media where compatible with the product flow, and keep playback controls usable while media is loading or unavailable.

## 8. Layout, style, and paint

Avoid forced synchronous layout patterns such as repeatedly reading geometry after writing styles/classes inside one interaction loop.

Preferred order:

1. read required layout state;
2. compute;
3. apply writes together;
4. allow the browser to render.

Use CSS for presentation state that does not require JavaScript measurement. Prefer transform and opacity for motion where they preserve semantics and visual requirements.

Large blur, shadow, backdrop-filter, fixed background, and continuously animated effects require measurement on representative mobile hardware before broad use. Relay tokens define visual ownership but do not make an expensive effect free.

## 9. Motion and reduced motion

Relay's motion durations remain authoritative:

- fast: 140 ms;
- base: 180 ms;
- slow: 260 ms.

Motion must begin promptly after the triggering interaction. A 180 ms transition that waits behind 300 ms of synchronous work is not a 180 ms interaction.

For `prefers-reduced-motion`:

- remove or substantially simplify non-essential motion;
- do not replace animation with a blocking JavaScript delay;
- preserve immediate state/focus changes and equivalent product information.

Animation completion must not be the sole point at which authoritative state is committed.

## 10. Spartan, Relay, and feature ownership

### Spartan Brain and Helm own

- generic keyboard/focus state machines;
- overlay open/close mechanics;
- roving focus and selection mechanics;
- primitive-level disabled/pressed/expanded behavior;
- reusable control DOM required for accessible behavior.

Feature code must not fork those mechanics to gain a small benchmark improvement.

### Relay owns

- semantic visual tokens;
- reusable spacing, sizing, responsive presentation, radius, elevation, and motion defaults;
- shared loading/progress/feedback compositions where adopted;
- touch-target and reflow defaults.

### Feature/domain code owns

- domain-specific data bounds;
- which records must be rendered;
- request cancellation and stale-result policy;
- domain-specific optimistic behavior;
- expensive derived computation;
- when work can be deferred or moved to a worker;
- product-specific performance telemetry dimensions.

No layer may hide a slow dependency by returning fictional data or false success.

## 11. Responsive, theme, RTL, and zoom parity

Performance budgets apply to the full supported UI contract, not only light-theme LTR desktop.

Representative validation must include:

- 390px mobile;
- tablet and desktop reference viewports;
- light and dark themes;
- RTL shell/content where applicable;
- long translated content;
- 200 percent zoom;
- 400 percent zoom for reflow-sensitive interactions;
- reduced motion.

Do not create a faster second template that diverges semantically from the normal responsive tree. A responsive composition may hide or move presentation, but duplicate interactive DOM trees must not both remain active.

Theme changes and per-user primary accent changes must not trigger broad application reinitialisation or repeated data fetching. Visual token updates are presentation state.

## 12. Realtime and high-frequency updates

Centrifugo, LiveKit, media timers, presence, typing indicators, and other high-frequency sources must not cause one full feature render per transport event when events can be coalesced safely.

Rules:

- validate and discard malformed/stale events early;
- preserve stable entity identity;
- batch/coalesce presentation updates when multiple events target the same frame and doing so does not lose product semantics;
- do not update persistent state for every playback/time tick when a lower visual frequency is sufficient;
- clean up subscriptions/listeners/timers when their owning feature leaves the active lifecycle;
- bound reconnect replay work;
- ensure a realtime flood cannot starve typing, navigation, or call controls.

Dropping authoritative domain events is not an acceptable performance strategy. Coalesce only presentation work or events whose product semantics explicitly permit it.

## 13. Network and mutation feedback

Interaction performance includes the waiting experience even when the network is the dominant cost.

Required patterns:

- show truthful pending state promptly;
- cancel superseded reads when possible;
- use idempotency/duplicate-submit protection for mutations that can be retried;
- preserve useful existing content during refresh when safe;
- distinguish initial loading, refreshing, stale, empty, unavailable, and error states;
- do not clear a large surface and rebuild it just to display a spinner;
- do not execute repeated retries on the UI thread or retry permanent failures.

## 14. Measurement profiles

### 14.1 Development profiling

For a reported slow interaction:

1. reproduce with production or production-like build settings;
2. capture a browser Performance trace;
3. identify input delay, handler duration, rendering delay, and long tasks;
4. distinguish application code, third-party code, style/layout, paint, image decode, and network wait;
5. record the before/after interaction and trace conditions in the PR.

Do not use dev-mode Angular timings as the only production performance evidence.

### 14.2 CI lab profile

The follow-up verification gate should use deterministic representative interactions in Chromium with a documented CPU slowdown and viewport profile. The exact runner hardware is not a portable product promise, so CI should compare to an explicit lab budget and track regressions rather than pretending the runner equals a user's phone.

A suitable first reference matrix is:

- 390px mobile viewport under CPU slowdown;
- normal desktop viewport for dense data surfaces;
- one high-zoom/reflow interaction;
- reduced-motion mode for overlay/navigation timing parity.

### 14.3 Field telemetry

When field performance telemetry is implemented:

- collect Web Vitals or equivalent bounded numeric measurements;
- use bounded route/surface identifiers rather than raw URLs where URLs may contain private IDs;
- do not collect input values, message text, search text, profile names, room names, tokens, or media URLs;
- sample and aggregate to control cost and privacy;
- separate browser/device class only at a coarse, bounded level;
- document retention and user/privacy policy.

## 15. Reference interaction budgets

These are the default budgets. A feature may define a stricter budget or a reviewed exception with evidence.

| Interaction | Default budget | Notes |
| --- | ---: | --- |
| Local control/open/selection next useful paint | <= 100 ms | Menu, disclosure, loaded tab, selection state |
| Network-backed action acknowledgement | <= 100 ms | Busy/pending feedback, not fabricated completion |
| Field INP health | <= 200 ms p75 | Track separately for materially different surfaces |
| Single main-thread task in routine interaction | <= 50 ms | Longer work must be reviewed/yielded/moved |
| Continuous frame interval at 60 Hz | 16.7 ms | Browser total; feature JS should retain headroom |
| Feature JS during continuous frame work | target <= 8 ms | Guideline for drag/scroll/draw/seek loops |
| Relay standard motion | 140/180/260 ms | Must start promptly after input |

A benchmark exception must state:

- interaction and user value;
- measured environment;
- why the default cannot currently be met;
- accessibility/correctness impact;
- mitigation;
- owner;
- expiry or removal trigger.

Permanent blanket exceptions such as "chat is complex" are not acceptable.

## 16. Migration examples

### 16.1 Expensive filter on every keystroke

Avoid:

```ts
onInput(value: string): void {
  this.visibleRows.set(this.allRows().filter((row) => expensiveMatch(row, value)));
  void this.api.search(value);
}
```

Prefer a model where the input signal updates immediately, local work is bounded/memoised, remote search is debounced and cancellable, and stale responses cannot win:

```ts
readonly query = signal('');
readonly visibleRows = computed(() => filterBoundedRows(this.rows(), this.query()));

onInput(value: string): void {
  this.query.set(value);
  this.remoteSearch.schedule(value);
}
```

The exact debounce belongs to the search product contract, not to the shared input primitive.

### 16.2 Pointer redraw

Avoid redrawing a canvas or reading/writing layout for every raw pointer event.

Prefer collecting bounded/coalesced pointer samples and scheduling one render update with `requestAnimationFrame`, while preserving the complete document model required by the drawing feature.

### 16.3 Rebuilding a large list

Avoid deriving a new identity for every record on every realtime update.

Prefer stable IDs and updating only the affected entities. If the view intentionally retains thousands of records, use the repository's approved virtualisation/windowing boundary rather than placing every record in the DOM.

### 16.4 Overlay startup

Avoid fetching basic static picker data only after the first click if it forces a visibly blank overlay and cannot be cached or lazy-loaded predictably.

Prefer lazy-loading heavy code/data at an appropriate feature boundary, then open the Spartan overlay with immediate accessible pending/ready state. Do not fork Spartan focus/dialog mechanics to pre-render a second hidden overlay tree.

## 17. Prohibited patterns

The following require an explicit reviewed exception or are prohibited outright:

- synchronous busy-wait loops;
- routine interaction handlers intentionally exceeding 50 ms;
- unbounded rendering of server collections;
- unbounded recursive or polling timers in feature components;
- polling every animation frame for state that can be event-driven;
- network calls on every raw pointer move or scroll event;
- non-passive scroll listeners when `preventDefault()` is not needed;
- full-list deep clone/JSON serialize cycles on every keystroke;
- `setTimeout(..., 0)` chains used to disguise continuously blocking work;
- repeated layout read/write alternation inside one interaction loop;
- using array index as identity for reorderable interactive records;
- feature-owned copies of Spartan focus/keyboard mechanics for performance reasons;
- hiding required accessible content to improve a benchmark;
- disabling themes, RTL, zoom, or translations in performance tests;
- reporting only desktop dev-mode timings as proof of mobile production performance;
- raw user IDs, private URLs, messages, prompts, or search text in performance metric labels;
- fictional success/loading content used to make an interaction appear faster.

## 18. Required verification gate

Follow-up issue #5530 should implement the executable migration gate for this architecture standard.

The gate should combine cheap static checks with a small real-browser interaction budget rather than trying to solve performance entirely through lint.

### Static/change-based checks

At minimum, detect newly introduced high-risk patterns where they are reliably machine-detectable, for example:

- direct unbounded `window`/document scroll or wheel listeners without reviewed ownership;
- direct feature `setInterval` loops that are not lifecycle-cleaned or explicitly exempted;
- newly introduced eager imports of known heavy feature packages in the application shell when a lazy boundary exists;
- newly introduced very large Angular production bundle or component-style growth through existing build budgets;
- removed collection bounds/virtualisation from designated high-volume surfaces.

Do not create noisy regex rules for complexity that cannot be inferred safely from source.

### Browser interaction checks

Maintain a small versioned set of representative interactions, initially:

1. type into the chat composer while history is populated;
2. switch a Discovery filter and render bounded results;
3. open and close a Spartan dialog/picker with keyboard focus restoration;
4. grade an SRS card and advance to the next item;
5. scroll or append a populated chat/feed;
6. exercise one 390px/high-zoom overlay or form interaction.

The browser harness should collect:

- interaction start to next useful paint where practical;
- long-task entries during the interaction window;
- deterministic application marks around repository-owned work;
- rendered item/DOM bounds for designated large collections;
- focus/semantic success so a fast broken interaction cannot pass.

Use a baseline/threshold policy that tolerates normal CI noise but fails clear regressions. Store raw trace artifacts for failed runs rather than logging private fixture content.

### Field-health check

Field INP is an operational/SLO signal, not a deterministic PR check. CI cannot prove p75 field INP. The deployment/telemetry layer should alert on sustained field regressions separately once privacy-approved performance telemetry exists.

## 19. Testing strategy

Unit and component tests should prove performance-related invariants where deterministic:

- stale async results cannot overwrite newer state;
- subscriptions/timers/listeners are cleaned up;
- duplicate mutation submission is suppressed where required;
- list output remains bounded;
- expensive work is not performed for unchanged inputs;
- reduced-motion state removes non-essential animation without delaying correctness;
- realtime bursts are coalesced only where semantics permit it.

Browser tests should prove actual interaction behavior and trace timing. Production build budgets should continue to guard delivery size. No single tool replaces the others.

## 20. Rollout and rollback

Performance migrations should land by interaction or component family, not as a repository-wide rewrite.

For each material optimisation:

1. capture the current behavior and timing;
2. preserve functional/accessibility regression coverage;
3. implement the bounded optimisation;
4. validate light/dark, RTL, responsive, zoom, and reduced-motion states relevant to the interaction;
5. compare production-like traces;
6. retain a safe rollback when changing concurrency, caching, virtualisation, or worker boundaries.

Rollback must restore correct behavior, not reintroduce an unbounded or privacy-unsafe path merely because it was faster to ship.

## 21. Definition of done for feature migrations

A UI migration affecting a performance-sensitive interaction is complete when:

- the user-facing interaction remains functionally and semantically equivalent or intentionally improved;
- the relevant default budget is met or a reviewed, time-bounded exception is documented;
- no routine feature-owned long task above 50 ms is introduced without review;
- collection/rendering work is intentionally bounded;
- stale/cancelled async work cannot corrupt the current interaction;
- listeners, observers, subscriptions, timers, and media resources are lifecycle-clean;
- keyboard, pointer/touch, screen reader, RTL, themes, responsive layouts, 200 percent/400 percent zoom, and reduced motion remain correct where applicable;
- no private user content is added to traces, labels, or analytics;
- production build and relevant browser/component verification pass.

## 22. References

- `DESIGN.md`
- `docs/spartan-relay-architecture.md`
- `docs/390px-mobile-baseline.md`
- `docs/200-percent-zoom-behaviour.md`
- `docs/angular-lazy-loading.md`
- `.agents/automations/task-daily-performance-audit.md`
- [Interaction to Next Paint](https://web.dev/articles/inp)
- [Optimize Interaction to Next Paint](https://web.dev/articles/optimize-inp)
- [Long Tasks API](https://developer.mozilla.org/docs/Web/API/PerformanceLongTaskTiming)
- [PerformanceObserver](https://developer.mozilla.org/docs/Web/API/PerformanceObserver)
- [Angular performance](https://angular.dev/best-practices/runtime-performance)

## 23. Decision record

The canonical interaction-performance policy is:

1. Relay and Spartan correctness/accessibility contracts remain hard requirements.
2. Use INP as the field interaction-health metric, targeting 200 ms or better at p75.
3. A routine user action should acknowledge within 100 ms even when authoritative completion is asynchronous.
4. Feature-owned work must not normally create an unbroken main-thread task above 50 ms.
5. Continuous visual work retains frame headroom instead of consuming the full 16.7 ms frame interval.
6. Bound collections and cancel stale work before adding caches or low-level optimisations.
7. Performance verification must represent mobile, themes, RTL, zoom/reflow, reduced motion, and accessibility semantics rather than testing a stripped-down benchmark UI.
8. Follow-up #5530 owns executable enforcement, with browser timing plus narrowly scoped static guards.
