# Mobile UI Audit Report

## 1. Thumb Reach
- **Bottom Navigation**: Implemented correctly via `app-navigation-tabs` pinned to the bottom. Uses `.pb-safe` to avoid overlapping the home indicator on iOS.
- **Top Actions**: Header actions may be hard to reach on large devices, but primary navigation and core interactions are bottom-aligned.

## 2. Keyboard Behaviour
- **Skip-to-content**: Present in `app.component.html` for keyboard users.
- **Focus Rings**: Handled well globally using `focus-visible` ring styling for keyboard accessibility without affecting touch interactions (see `styles.scss`).
- **Input Forms**: Spartan primitives (like `hlmInput`, `hlmBtn`) are used to preserve native keyboard behaviors while allowing custom styling.

## 3. Scrolling & Overscroll
- Layouts are structured as flex columns with `min-h-[100dvh]` to handle mobile browser chrome shrinking/expanding properly.
- No apparent misuse of `overscroll-behavior: none` that would break native pull-to-refresh unless explicitly inside a specialized canvas or modal.

## 4. Overlays & Modal Stacking
- **Z-Index Strategy**: Defined clearly in `app.component.html`.
  - Bottom Nav: `z-50`
  - Forced Update Modal: `z-[11000]`
  - Other overlays (Gift Animation, Incoming Call) have high `z-index` to stack properly over the main content.
- Uses `@spartan-ng/helm/dialog` for semantic modal/dialog implementation, which properly handles `aria-modal="true"`, focus trapping, and `Escape` key dismissing.

## 5. Safe Areas
- Uses standard CSS environment variables for safe areas (e.g., `.pb-safe` mapped to `env(safe-area-inset-bottom)`).
- The root layout sets `min-h-[100dvh]` to account for dynamic viewport heights on mobile.

## 6. Back-Navigation
- Angular router is used extensively. Modals (`hlm-dialog`) can be closed via the UI or `Escape`.
- For swipe-to-back on mobile, native browser behavior handles standard routing, provided `overscroll-x` isn't aggressively blocked on the body.

## 7. Touch Targets
- Minimum touch target sizes appear to be respected (e.g., using `w-11`, `h-11`, or sufficient padding `p-2` on icons/buttons in `app.component.html`).
- Padding and margins are used extensively to separate interactive elements.

## 8. Media Capture & Voice Recording
- Uses a client-side `AudioCompressionService` (`frontend/src/app/services/audio-compression.service.ts`) to compress audio to 16kHz Mono before upload, reducing data usage.
- Supports drafts with varying media types (`images`, `audio`).

## 9. Long Presses
- A `LongPressContextMenuComponent` exists (`frontend/src/app/components/long-press-context-menu`) for handling custom long-press actions, properly exposing a keyboard-accessible alternative according to tests.

## 10. Transitions
- Extensive use of Tailwind's `transition-colors` for button states (`hover`, `focus`).
- No complex layout animations that might block the UI thread appear in the global layout shell.
