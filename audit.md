# Mobile UI Audit Report

## 1. Thumb Reach
- **Bottom Navigation**: Pinned to the bottom (`fixed bottom-0`, `.pb-safe`) ensuring primary interactions are within thumb reach.

## 2. Keyboard Behaviour
- **Skip-to-content**: `skip-to-content` link exists in `app.component.html` (`focus:not-sr-only focus:fixed`).
- **Input Forms**: Utilises Spartan primitives (e.g., `@spartan-ng/helm/dialog`) keeping keyboard behaviours.

## 3. Scrolling & Overscroll
- Layouts are structured as flex columns with `min-h-[100dvh]` handling mobile browser navigation bar dynamically.
- `overscroll-contain` is heavily used in dialogs (e.g. `correction-modal.component.html`, `report-user-modal.component.html`) to prevent scroll chaining to the underlying page.

## 4. Overlays & Modal Stacking
- **Z-Index Strategy**: Defined clearly in `app.component.html`.
  - Lightbox: `z-[100]`
  - Bottom Nav: `z-50`
  - Forced Update Modal: `z-[11000]`
- Semantic modals handle focus trapping and `.backdrop-blur-sm`.

## 5. Safe Areas
- Uses standard CSS environment variables for safe areas (e.g., `.pb-safe` for `env(safe-area-inset-bottom)`) in the global layout (`app.component.html`).
- The root layout uses `min-h-[100dvh]` to account for dynamic viewport heights.

## 6. Back-Navigation
- Modals (`hlm-dialog`) can be closed via the `Escape` key natively.

## 7. Touch Targets
- Proper touch targets size are respected (e.g., `w-16` on tab items in `app.component.html`).

## 8. Media Capture & Voice Recording
- Native `navigator.mediaDevices.getUserMedia({ audio: true })` and `video: true` are used directly in features like `audio-recorder.component.ts` and `instant-video-recorder.component.ts`.
- `AudioCompressionService` compresses audio to 16kHz Mono before upload.

## 9. Long Presses
- A `LongPressContextMenuComponent` exists (`frontend/src/app/components/long-press-context-menu`) mapping long presses for context menus.

## 10. Transitions
- Subtle hover and focus transitions are standard (`transition-colors` on buttons and tab items).
