# Angular Motion

This repository targets Angular 22 and is preparing for Angular 23. Do **not** add `@angular/animations`, `provideAnimations()`, `provideAnimationsAsync()`, `BrowserAnimationsModule`, or the legacy trigger/state animation DSL.

Use the repository motion hierarchy instead:

1. CSS transitions/keyframes for ordinary state changes.
2. Angular `animate.enter` and `animate.leave` for DOM entry/exit lifecycle.
3. The repository `ViewTransitionService` for progressive route/shared-element transitions.
4. The governed `lottie-web` adapter only for approved authored illustrations.

## Native CSS animations

Prefer semantic Relay motion tokens and transform/opacity where appropriate. Motion must never block input readiness or become the only way state is communicated.

```html
@if (isShown()) {
  <div class="enter-container" animate.enter="enter-animation">
    <p>The box is entering.</p>
  </div>
}
```

```css
.enter-animation {
  animation: slide-fade var(--motion-duration-standard, 200ms)
    var(--motion-easing-enter, ease-out);
}

@keyframes slide-fade {
  from {
    opacity: 0;
    transform: translateY(0.5rem);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .enter-animation {
    animation: none;
  }
}
```

## Entry and exit callbacks

When imperative completion is genuinely required, use Angular's native animation callback API from `@angular/core`:

```html
@if (isShown()) {
  <div (animate.leave)="onLeave($event)">...</div>
}
```

```ts
import { AnimationCallbackEvent } from '@angular/core';

onLeave(event: AnimationCallbackEvent): void {
  // Complete any bounded imperative work, then release the element.
  event.animationComplete();
}
```

Do not use animation completion to commit authoritative business state.

## State transitions

For stateful components, toggle classes or data attributes and let CSS own presentation:

```html
<div [class.open]="isOpen()">...</div>
```

```css
.panel {
  opacity: 0;
  transition: opacity var(--motion-duration-fast, 150ms) ease-out;
}

.panel.open {
  opacity: 1;
}
```

## Accessibility and lifecycle requirements

Every motion change must preserve:

- `prefers-reduced-motion` behavior;
- focus placement and restoration;
- screen-reader reading order and announcements;
- RTL and logical layout;
- 200–400% zoom/reflow;
- touch and keyboard input;
- SSR/hydration correctness;
- cancellation/cleanup on rapid navigation or component destruction.

If a third-party component appears to require the deprecated Angular animation runtime, verify its current Angular 22 support and prefer a supported/native configuration. Do not re-introduce the deprecated runtime as a local workaround without an explicit architecture decision.