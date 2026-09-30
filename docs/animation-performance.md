# Relay + Spartan animation performance architecture

Issue: #5537 (`Spartan UI 0071`)

Status: authoritative architecture contract for product animation performance. Follow-up #5538 owns the migration verification gate.

## Purpose

Animation is a progressive presentation layer. It must never make input slower, delay authoritative state, destabilize layout, hide focus, increase memory without a bound, or become required for a task to complete.

This document defines the performance contract for animation across Angular feature code, Relay product primitives, Spartan Helm/Brain primitives, native View Transitions, CSS motion, requestAnimationFrame loops, and authored animation assets.

It complements rather than replaces:

- `docs/motion-duration-easing.md` for Relay timing roles;
- `docs/reduced-motion-architecture.md` for the global reduced-motion boundary;
- `docs/native-motion-and-view-transitions.md` for motion technology selection and View Transition privacy rules;
- `frontend/scripts/check-motion-contract.mjs` for the existing structural motion guard.

## Current implementation audit

The repository already has several strong foundations.

### Relay timing ownership

`frontend/src/styles.scss` and `frontend/tailwind.config.js` expose the shared motion roles used by product-facing motion:

- `duration-fast` / `--app-motion-fast`: 140 ms;
- `duration-base` / `--app-motion-base`: 180 ms;
- `duration-slow` / `--app-motion-slow`: 260 ms;
- `ease-app` / `--app-ease-standard`: the Relay standard easing curve.

`frontend/scripts/check-motion-contract.mjs` verifies these tokens and rejects legacy or arbitrary durations and hard-coded product easing inside shared primitives.

### Reduced motion

`frontend/src/reduced-motion.scss` and `scripts/verify-reduced-motion-contract.mjs` provide the central `prefers-reduced-motion: reduce` boundary. Product code must inherit that boundary rather than creating feature-local motion preferences.

### Native motion

`frontend/src/app/core/motion/view-transition.service.ts` treats View Transitions as progressive enhancement. The application update still happens when snapshots are unsupported, reduced motion is requested, or snapshotting is intentionally disabled.

### Continuous animation

`frontend/src/app/services/gift-animation.service.ts` is an example of an explicitly bounded requestAnimationFrame loop. It:

- prevents overlapping loops;
- caps living particles at 90;
- stops after a bounded duration;
- cancels the active animation frame;
- clears particle state during cleanup.

This pattern is substantially safer than unbounded timers or independent per-particle loops, but continuous animation remains the highest-risk motion category and must be justified per feature.

### Remaining migration risk

The component migration can still introduce performance regressions through:

- new infinite decorative animations;
- layout-affecting animation properties;
- high-cost filters, shadows, masks or large translucent layers;
- uncancelled requestAnimationFrame or timer loops;
- multiple simultaneous animation systems on one surface;
- eager loading of authored animation runtimes or assets;
- animation callbacks that perform application work every frame;
- motion that continues while hidden, detached or irrelevant;
- animation that blocks pointer, keyboard or assistive-technology input;
- feature-specific timing that bypasses Relay roles;
- reduced-motion variants that still perform the expensive work invisibly.

The architecture below is the required target state.

## Principles

1. Correctness is independent of animation.
2. Input and state updates win over visual continuity.
3. CSS transform and opacity are the default product animation properties.
4. Continuous animation is exceptional and bounded.
5. Relay owns product timing. Spartan Brain owns interaction state.
6. Reduced motion removes unnecessary work, not only visible movement.
7. Hidden, offscreen, replaced and destroyed motion is cancelled.
8. Animation assets and runtimes are lazy and bounded.
9. The same performance contract applies in light, dark, RTL and high-zoom states.
10. Performance regressions require a measurable justification, not a visual preference.

## Performance budgets

These budgets apply to product-authored motion. Browser internals and third-party primitives may be measured differently, but wrappers must keep the user-visible result inside the same interaction budget.

### Input acknowledgement

An input that starts or changes an animation must update visible or semantic state within 100 ms. Animation must not be used to defer a click, key, submit, navigation, focus move, optimistic state change or cancellation.

Examples:

- a pressed button disables immediately before a success animation begins;
- a dialog close removes or disables interaction immediately even if an exit transition remains visible briefly;
- a route change begins immediately and View Transition snapshots follow the navigation rather than delaying it;
- Escape dismisses an overlay immediately from the interaction model.

### Long tasks

Animation code must not intentionally schedule main-thread tasks of 50 ms or longer. Expensive preparation must be moved out of the interaction path, split into smaller work, cached, precomputed, or removed.

### Frame work

At a 60 Hz refresh rate the browser has roughly 16.7 ms for an entire frame. Product-authored requestAnimationFrame callbacks should normally consume no more than about half of that budget so style, layout, paint, compositing, input and browser work retain headroom.

For a continuous animation loop:

- target product JavaScript work per frame: <= 8 ms at p75 on representative mobile hardware;
- do not allocate an unbounded number of new objects per frame;
- do not perform network, storage, parsing or application persistence work from the frame callback;
- do not trigger synchronous layout measurement followed by layout mutation in the same loop unless the interaction cannot be implemented otherwise and is measured.

The 8 ms target is a design budget, not permission to consume 8 ms on every frame. Ordinary CSS motion should consume little or no application JavaScript per frame.

### Interaction responsiveness

Animation must not cause the feature to miss the repository interaction responsiveness target. During animated states, pointer and keyboard actions remain available and do not wait for animation completion.

### Continuous duration

Decorative continuous motion is prohibited by default. Functional continuous motion must have a bounded lifecycle or an explicit pause/stop condition.

Examples that may qualify:

- an active recording or live-audio indicator;
- an indeterminate loading state while genuine work is active;
- a short celebration or gift effect;
- a user-controlled media visualisation.

A decorative animation that can run forever solely because a component remains mounted does not qualify.

## Technology selection

Use the lightest implementation capable of expressing the interaction.

### CSS transitions and keyframes

Use for ordinary state changes and short decorative transitions.

Preferred properties:

- `transform`;
- `opacity`.

Use with care:

- small, bounded colour transitions;
- border colour;
- background colour;
- box shadow on small surfaces when measurement shows no problem.

Avoid animating:

- `width` and `height` for repeated or large motion;
- physical offsets such as `left` and `right`;
- large `top`/`bottom` movement that forces layout;
- large blur/filter values;
- large-area shadows that repaint continuously;
- `background-position` over large surfaces;
- properties that cause repeated layout of long lists or page shells.

When expansion/collapse genuinely requires dimension animation, keep the affected subtree small and measure the result on mobile and at high zoom.

### Angular enter and leave

Use Angular lifecycle motion only when DOM entry/exit needs lifecycle coordination. The semantic state must not remain artificially interactive during an exit animation.

Required behavior:

- remove or disable interaction as soon as the state closes;
- preserve deterministic focus return;
- tolerate rapid add/remove cycles;
- cancel cleanly when the owning component is destroyed;
- preserve equivalent state with animation disabled.

### View Transition API

Use the repository `ViewTransitionService` rather than direct feature-level snapshot orchestration.

View transitions are inappropriate when:

- snapshotting would expose sensitive content;
- the navigation is already expensive enough that snapshots materially worsen responsiveness;
- rapid repeated navigation would create churn without user value;
- the transition cannot preserve focus, scroll or route semantics;
- reduced motion is active.

### requestAnimationFrame

Use requestAnimationFrame only when visual state genuinely must be calculated each frame and CSS cannot express the interaction.

Every loop must have:

- one clear owner;
- one stored frame handle;
- a cancellation path;
- a terminal condition;
- destroy cleanup;
- a reduced-motion path;
- a hidden/offscreen strategy where relevant;
- a bounded number of rendered objects;
- tests for start, replacement, cancellation and teardown.

Do not create one requestAnimationFrame loop per child object when one parent loop can update all children.

Do not update Angular signals or component state every frame unless the DOM genuinely needs that update. Prefer direct compositor-driven CSS motion where possible.

### Timers

Timers are not animation clocks. `setInterval`, RxJS `interval`, and repeated `setTimeout` callbacks must not be used to approximate frame animation.

Timers may coordinate bounded state transitions such as a short auto-dismiss period, but teardown and replacement must cancel the logical work.

### Lottie and authored animation

Use the existing repository-owned `lottie-web` adapter for approved authored animation. Do not introduce a second runtime wrapper for the same capability.

Requirements:

- lazy-load runtime and asset;
- use repository-owned or approved allowlisted assets;
- keep decoded complexity and asset size bounded;
- pause when hidden/offscreen where practical;
- bound loop count for decorative content;
- destroy player/listeners on teardown;
- provide static failure and reduced-motion states;
- do not fetch arbitrary user-provided animation URLs.

### Rive or new animation runtimes

A new runtime requires a measured product need that CSS, Angular entry/exit, View Transitions and the existing Lottie adapter cannot satisfy. It must be lazy, removable and evaluated for bundle, CPU, GPU, memory, battery, SSR, accessibility and reduced-motion impact before adoption.

## Ownership model

### Spartan Brain

Spartan Brain owns interaction semantics and state such as:

- open/closed;
- selected/unselected;
- disabled;
- focus management;
- keyboard behavior;
- ARIA relationships.

Feature code must not duplicate those semantics to coordinate animation.

### Spartan Helm

Generated Helm primitives may retain upstream implementation details required for regeneration fidelity. Avoid ad-hoc edits to generated motion solely for product styling.

### Relay

Relay owns reusable product-facing timing, easing and presentation conventions. Shared wrappers should map product transitions to Relay motion roles.

### Feature code

Feature code owns only motion that is genuinely feature-specific. It must consume Relay roles and the shared accessibility boundary rather than introducing new global timing or easing systems.

## Lifecycle and cancellation

Every animation has an owner and terminal state.

### Component teardown

On component or service teardown:

- cancel requestAnimationFrame handles;
- clear relevant timers/listeners;
- destroy authored-animation players;
- disconnect observers;
- release large transient arrays or canvases;
- stop work that can no longer affect visible UI.

### Replacement

Starting a new animation of the same role must replace or join the existing one predictably. Do not allow rapid repeated actions to create parallel loops, stacked timeouts or stale completion callbacks.

### Visibility

Continuous or expensive animation should stop or pause when the page is hidden or the animated region is no longer relevant. IntersectionObserver or Page Visibility may be used where they reduce meaningful work without complicating correctness.

Correctness must not depend on visibility callbacks firing.

## Reduced motion performance

`prefers-reduced-motion: reduce` is both an accessibility boundary and a performance boundary.

When reduced motion is active:

- skip View Transition snapshots;
- do not start decorative requestAnimationFrame particle work and merely hide its output;
- do not decode/play non-essential authored animation only to display a static frame;
- replace shimmer, pulse, parallax and large movement with static or immediate state where possible;
- preserve loading, success, error, focus and progress meaning;
- preserve the same available actions.

The reduced-motion path should perform less animation work than the default path.

## Input, focus and assistive technology

Animation cannot own interaction state.

- Pointer events remain responsive throughout visible transitions unless the actual state is disabled.
- Keyboard activation is handled by the real control or Spartan primitive, not animation callbacks.
- Focus movement happens according to semantic state, not at an arbitrary animation-end event.
- Screen-reader announcements come from DOM state and live regions, not visual animation completion.
- Exit motion must not leave invisible focusable content in the tab order.
- Loading animation must not replace a real accessible loading or busy state.
- Motion cannot be the only indication of success, failure, selection or progress.

## Lists, feeds and virtualised surfaces

Animating many children individually is expensive and visually noisy.

For feeds, search results, chat histories, vocab lists and grids:

- do not animate every item on initial hydration/render;
- do not stagger hundreds of children;
- animate a bounded changed item or container when motion materially helps orientation;
- preserve list identity and tracking so animation does not cause unnecessary DOM replacement;
- avoid per-item observers or timers where one container-level mechanism suffices;
- keep realtime inserts immediately interactive.

If a list can grow without a small fixed bound, its animation strategy must also remain bounded.

## Overlays and dialogs

Overlay motion must remain cheap because it coincides with focus trapping, backdrop paint and often expensive underlying pages.

- Prefer opacity and transform for panel/backdrop transitions.
- Do not animate backdrop blur over a large viewport unless measured and justified.
- Do not delay focus trap activation until entrance motion completes.
- Do not delay semantic dismissal or focus return until exit motion completes.
- At 200% and 400% zoom, overflow and scrolling must work without relying on animation.
- Repeated open/close must not accumulate listeners or detached overlays.

## Canvas, SVG and particle effects

Canvas/SVG/particle animation requires an explicit object bound.

For SVG/DOM particles:

- cap simultaneously rendered objects;
- remove dead objects promptly;
- avoid creating per-particle framework subscriptions;
- avoid large SVG filters on every particle;
- use one animation loop where frame calculation is necessary.

For canvas:

- cap device-pixel-ratio allocation to a documented level when full native DPR would create excessive memory;
- release backing buffers on teardown where appropriate;
- avoid readback (`getImageData`) during animation unless required;
- keep pointer handling separate from decorative frame work.

The current gift animation's `MAX_PARTICLES = 90` is a useful example of an explicit resource bound, not a universal product limit.

## Loading and progress motion

Loading animation must correspond to genuine pending work.

- Stop animation when the operation succeeds, fails or is cancelled.
- Do not keep a spinner running behind an error or empty state.
- Prefer determinate progress when truthful progress is available.
- Repeated skeleton shimmer across a large page should be avoided; one bounded loading surface is preferred.
- Reduced motion uses static equivalents while retaining `aria-busy`, progress semantics or status text.

## Theme and user accent parity

Animation performance behavior must not change between light and dark themes or between user accent choices.

Theme changes may alter token values, but must not:

- load a separate animation runtime;
- double-render theme-specific animated trees;
- introduce theme-only filters or effects with materially higher cost;
- restart long-running decorative animation unnecessarily.

## RTL and localisation

Motion must use logical/spatial meaning rather than hard-coded physical direction where direction is language-dependent.

- Drawer/slide direction follows the component's documented spatial contract.
- Inline directional motion uses logical start/end behavior when language direction matters.
- Do not animate physical `left`/`right` layout properties as an RTL implementation.
- Long translations must reflow without causing a different, more expensive animation system.
- Locale changes must not leave stale animation listeners or duplicated transition trees.

## Responsive and high-zoom behavior

The animation contract applies at the 390px mobile baseline, tablet and desktop layouts, and at 200%/400% browser zoom.

At narrow effective widths:

- motion may simplify rather than preserve a wide-layout trajectory;
- animation must not create horizontal page overflow;
- fixed/sticky animated elements must not block essential content;
- large movement distances should be reduced when they no longer aid spatial comprehension;
- reflow happens from responsive layout, not animated physical positioning.

## SSR and hydration

Server rendering emits the semantic initial state. Animation is progressively attached after hydration.

Do not:

- make server/client initial markup differ solely to prepare an animation;
- read browser-only motion APIs during server rendering without a platform guard;
- start visual timers before hydration ownership is established;
- use animation to conceal hydration mismatches.

Entry animation after hydration must not cause a route to flash hidden or become temporarily inaccessible.

## Privacy and security

Animation features must not leak private data into:

- View Transition names;
- logs and performance marks;
- analytics event labels;
- asset URLs;
- CSS class names generated from user content.

View Transition snapshots can retain pixels briefly. Use the existing disable option when sensitive content should not be snapshotted.

Authored animation assets are code-adjacent inputs. Keep them repository-owned or allowlisted, size bounded and served through approved delivery paths.

## Observability

Performance diagnostics must be aggregate and privacy-safe.

Useful measurements include:

- interaction latency while animation is active;
- long-task count;
- dropped/slow-frame samples for explicitly measured high-value animations;
- animation runtime/asset load failure;
- unexpected overlapping-loop count;
- memory/listener leak regressions in browser tests.

Do not log message text, search terms, user names, media URLs, animation payload content or other user-authored values solely to diagnose animation performance.

## Migration examples

### Feature transition

Avoid:

```html
<div class="transition-all duration-500">...</div>
```

Prefer a targeted transition using Relay roles:

```html
<div class="transition-opacity duration-base ease-app">...</div>
```

If movement is needed, transition transform explicitly rather than every animatable property.

### Repeated JavaScript timer animation

Avoid:

```ts
setInterval(() => this.x.update((value) => value + 1), 16);
```

Prefer CSS animation when the state is purely visual. If per-frame calculation is genuinely required, own one cancellable requestAnimationFrame loop with a terminal condition and resource bound.

### Application state at animation end

Avoid:

```ts
onAnimationEnd(): void {
  this.isOpen.set(false);
}
```

Prefer changing semantic state immediately and treating exit motion as presentation:

```ts
close(): void {
  this.isOpen.set(false);
}
```

The primitive/lifecycle layer may keep a short visual exit representation, but application correctness is already closed.

### Reduced motion

Avoid starting expensive particles and hiding them with `opacity: 0` under reduced motion.

Prefer not starting the particle loop at all and render the static semantic success state.

## Prohibited patterns

New or migrated product code must not introduce:

- infinite decorative motion without an explicit user-relevant reason and stop condition;
- `transition-all` on large/shared surfaces when a narrower property list is possible;
- feature-specific arbitrary duration utilities where a Relay role applies;
- hard-coded product cubic-bezier curves where `ease-app` applies;
- interval-driven frame animation;
- uncancelled requestAnimationFrame loops;
- independent frame loops per particle/list item;
- application persistence/network calls from frame callbacks;
- animation-dependent navigation, focus, validation or mutation correctness;
- large backdrop blur/filter animation without measured justification;
- theme-specific duplicate animated DOM trees;
- reduced-motion paths that still perform hidden decorative animation work;
- eager authored-animation runtime loading for a route that may never display the animation;
- arbitrary remote user-supplied animation assets;
- private/user-authored values in transition names or performance labels.

## Exceptions

An exception requires all of the following in the PR:

1. the product need;
2. why the standard path is insufficient;
3. a measured CPU/frame/input result on representative mobile hardware;
4. reduced-motion behavior;
5. lifecycle and cancellation behavior;
6. accessibility and RTL review;
7. asset/runtime size impact if relevant;
8. rollback plan.

Exceptions should be local to one component or adapter and must not create a second global motion system.

## Verification strategy for #5538

Follow-up #5538 should implement the smallest migration-safe automated guard that catches newly introduced performance hazards without failing on historical feature debt.

The gate should combine structural checks with a focused browser contract.

### Structural checks

At minimum, detect newly introduced:

- interval/timer-driven frame loops;
- requestAnimationFrame without a nearby cancellation/teardown path;
- infinite animation in feature code without an approved exception;
- `transition-all` in shared Relay/Spartan-facing primitives;
- animation of known high-risk layout properties in shared primitives;
- direct feature use of View Transition snapshots instead of `ViewTransitionService`;
- eager imports of authored-animation runtimes outside the repository adapter;
- missing reduced-motion handling for newly added continuous decorative animation.

The checker should compare against the base branch where existing migration debt would otherwise make the gate unusable.

### Browser checks

Use a small representative set rather than attempting to benchmark every component in CI. Include:

- one overlay/dialog transition;
- one list/realtime insertion surface;
- one bounded celebration or continuous visual effect;
- light and dark states;
- reduced-motion state;
- 390px mobile state;
- RTL state where directional motion is relevant.

The browser contract should verify:

- user input remains available during motion;
- no persistent animation continues after teardown;
- reduced-motion avoids the decorative continuous loop;
- no horizontal overflow is introduced at the mobile baseline/high zoom;
- repeated start/cancel cycles do not multiply active animation owners.

### Verification commands

The existing foundation checks remain required:

```bash
cd frontend
npm run check:motion-contract
cd ..
npm run check:reduced-motion-contract
```

#5538 should add one documented root command such as:

```bash
npm run check:animation-performance
```

That command should be safe for pull requests and merge-queue execution and should print actionable file/line failure messages for structural violations.

## Migration sequence

For each component or screen migration:

1. identify every active animation and its semantic purpose;
2. remove animation that does not improve comprehension or feedback;
3. map remaining timing to Relay roles;
4. choose the lightest motion technology;
5. narrow animated properties;
6. add explicit cancellation/resource bounds for JavaScript motion;
7. implement reduced-motion by avoiding unnecessary work;
8. verify focus, keyboard and screen-reader semantics independently of motion;
9. test light/dark, RTL, 390px and high-zoom states;
10. run motion, reduced-motion and component verification gates.

## Definition of done

Animation performance architecture is satisfied when:

- product timing uses Relay motion roles;
- interaction semantics remain owned by native/Spartan controls;
- ordinary motion uses compositor-friendly properties where practical;
- continuous animation is justified, bounded and cancellable;
- reduced motion avoids unnecessary animation work;
- teardown prevents orphaned loops/listeners/players;
- input and focus do not wait for animation completion;
- animation remains usable across themes, RTL, mobile and high zoom;
- authored animation is lazy, bounded and safe;
- performance diagnostics avoid user-authored/private content;
- follow-up verification can detect new migration regressions without requiring a risky repository-wide rewrite.

## Rollback

This issue changes architecture documentation only. Rollback is a normal revert of this document.

Runtime migrations based on this contract must preserve an immediate non-animated path. If an animation causes production performance or accessibility regressions, remove or disable the enhancement while retaining the underlying interaction and state transition. Do not roll back by restoring uncancelled loops, arbitrary timing, animation-dependent correctness, or reduced-motion violations.
