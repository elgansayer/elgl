# Native motion and View Transition policy

## Decision

Use the lightest motion layer that satisfies the interaction:

```text
CSS transitions and keyframes
  -> ordinary state changes

Angular animate.enter and animate.leave
  -> DOM entry and exit

View Transition API
  -> progressive route and shared-element continuity

lottie-web through one repository adapter
  -> authored, non-interactive illustration and celebration

Rive trial only
  -> genuinely interactive state-machine animation
```

The deprecated `@angular/animations` runtime and `provideAnimations()` provider are removed. The duplicate `ngx-lottie` wrapper is removed. Direct `lottie-web` remains behind the existing repository-owned player boundary.

Correct navigation, state updates and focus never depend on animation support or completion.

## Relay motion tokens

Motion must use semantic tokens rather than feature-specific durations:

```text
motion.duration.instant
motion.duration.fast
motion.duration.standard
motion.duration.deliberate
motion.easing.enter
motion.easing.exit
motion.easing.standard
motion.distance.small
motion.distance.medium
```

Current CSS may use token fallbacks while #7453 completes the shared token library. New feature-specific magic duration/easing values require a documented reason.

## View Transition service

Path:

```text
frontend/src/app/core/motion/view-transition.service.ts
```

`ViewTransitionService.run()` always executes the update. It creates native snapshots only when:

- the code is running in a browser;
- the browser provides `document.startViewTransition`;
- reduced motion is not requested;
- the caller has not disabled snapshots for privacy or product reasons.

An active transition is skipped before a replacement by default, preventing rapid navigation from leaving stale visual state.

### Usage

```ts
await this.viewTransitions.run(async () => {
  await this.router.navigate(['/profile', userId]);
});
```

Sensitive routes or media can disable snapshots explicitly:

```ts
await this.viewTransitions.run(
  () => this.router.navigate(['/private-media', assetId]),
  { disabled: true },
);
```

The callback must be correct when it runs without animation.

## Shared-element names

`ViewTransitionNameDirective` assigns a validated `view-transition-name`.

Allowed names:

```text
profile_avatar_user_1
moment_thumbnail_42
lesson_card_n5_12
```

Rules:

- begin with a letter;
- contain letters, numbers, hyphens or underscores only;
- maximum 64 characters;
- stable across source and destination;
- unique within the rendered document;
- never derived from email, message text, filenames, media URLs, search text or another private value;
- disabled where snapshotting sensitive content is inappropriate.

Use opaque application IDs or bounded route/model identifiers.

## Initial hero flows

Reference implementations should be added in this order:

1. discovery/profile avatar to profile header;
2. moment thumbnail to detail/media viewer;
3. lesson/card to focused learning detail;
4. chat attachment thumbnail to full-screen viewer after private snapshot review.

Each flow must preserve:

- route and history semantics;
- focus placement at the destination;
- scroll restoration;
- cancellation on rapid repeat navigation;
- unsupported-browser behaviour;
- reduced-motion behaviour;
- data authorization and privacy;
- loading/error correctness independent from animation.

## Native CSS motion

Use CSS for ordinary state transitions.

Prefer:

- transform and opacity when visually appropriate;
- logical properties;
- bounded durations;
- immediate input readiness;
- explicit cancellation/terminal state;
- non-motion equivalent information.

Avoid:

- animating large layout regions without measurement;
- infinite decorative movement;
- using a spinner to conceal unavailable/error state;
- delaying authoritative state changes until animation completes;
- preserving invisible interactive elements during exit;
- motion that interferes with focus or screen-reader announcements.

## Entry and exit

Use Angular `animate.enter` and `animate.leave` with CSS classes for DOM lifecycle integration.

Before migrating a component, test:

- focus return and overlay teardown;
- route and dialog cancellation;
- reduced motion;
- SSR/hydration;
- rapid add/remove;
- assistive-technology reading order;
- low-end mobile input readiness.

## Reduced motion

Under `prefers-reduced-motion: reduce`:

- View Transition snapshots are skipped;
- skeleton shimmer, spinner rotation and indeterminate progress use static alternatives;
- decorative entry/exit movement is removed or reduced to immediate opacity where needed;
- auto-scrolling and pulsing are disabled;
- information, focus and controls remain identical.

The application does not hide all state feedback; it removes unnecessary movement.

## Lottie

The existing direct `lottie-web` adapter remains the single authored-animation implementation.

Required lifecycle:

- allowlisted asset ID or repository-owned URL;
- source, licence and ownership metadata;
- compressed and decoded-size budget;
- lazy player and asset loading;
- bounded loop count;
- pause when hidden/offscreen where practical;
- destroy player/listeners on component teardown;
- static SVG/image/text fallback on load failure;
- static or simplified reduced-motion representation;
- deterministic paused/end-state visual tests.

Do not load an arbitrary remote animation URL supplied by a user or provider.

`ngx-lottie` is removed because maintaining a second wrapper does not add a second product capability.

## Rive trial

Rive is not a default dependency.

A trial qualifies only when a state machine materially reduces bespoke interaction logic, for example:

- AI avatar listening, thinking, speaking and error states;
- pronunciation coach responding to live score/state;
- a high-value interactive onboarding state that cannot be represented effectively with ordinary components.

The trial must measure:

- WASM/runtime and asset bundle;
- first-interaction readiness;
- low-end mobile CPU, GPU, memory and battery;
- SSR and lazy loading;
- keyboard and screen-reader equivalent state;
- reduced-motion/static fallback;
- design source/version ownership;
- automated testability;
- licence and provenance.

It ends in `ADOPT`, `REJECT_AND_REMOVE` or `DEFER_AND_REMOVE`. Decorative loops remain CSS, Lottie or static media.

## Accessibility

Motion is never the sole communication channel.

- Focus visibly moves to the real destination.
- Screen readers receive destination/state announcements from semantic DOM, not snapshots.
- Important state is not colour- or motion-only.
- Hero transitions do not hide page headings or skip links.
- At 400% zoom, navigation and layout remain usable without the transition.
- RTL does not reverse geographic/media meaning accidentally; logical layout is used.
- Animation controls, where present, are keyboard operable and labelled.
- Auto-playing non-essential motion can be stopped or is bounded.

## Privacy and security

View transitions can temporarily snapshot old and new visual states. Disable them for flows containing sensitive information when the privacy behaviour is not acceptable.

Never use transition names containing private/user-authored values.

Animation JSON and vector state-machine assets are code-adjacent untrusted inputs. Production assets must be repository-owned or supplied through an approved catalogue, size checked and served with safe headers.

## Testing

Run:

```bash
node scripts/verify-native-motion-platform.mjs
cd frontend
npx vitest run \
  src/app/core/motion/view-transition.service.spec.ts \
  src/app/core/motion/view-transition-name.directive.spec.ts
```

Reference hero flows also require browser tests for:

- API support and no support;
- reduced motion;
- rapid navigation and cancellation;
- focus and scroll restoration;
- destination loading/error;
- RTL and long translations;
- 400% zoom;
- sensitive snapshot disable;
- memory/listener cleanup;
- low-end performance and Core Web Vitals.

## Rollback

All native motion enhancement is progressive.

Disable View Transition calls or names and preserve immediate navigation. Restore a static Lottie fallback if player loading fails.

Do not restore:

- `@angular/animations` or `provideAnimations()`;
- `ngx-lottie` as a duplicate wrapper;
- animation-dependent business state;
- route snapshots for sensitive content without review;
- motion that ignores reduced-motion preference.
