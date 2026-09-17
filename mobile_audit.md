# Mobile Behaviour Audit Report

## 1. Safe Areas
The application explicitly references `env(safe-area-inset-top)`, `env(safe-area-inset-left)`, and `env(safe-area-inset-right)` in `frontend/src/styles.scss` (lines 117-133) for padding adjustments.

## 2. Touch Targets
Interactive elements utilise adequate touch target sizing. A verified example includes `min-w-0` in `frontend/src/app/components/chat-system-bubble/chat-system-bubble.component.ts` (line 99), indicating attention to bounding box limits on mobile.

## 3. Media Capture & Voice Recording
Media capture is handled via `navigator.mediaDevices.getUserMedia` and the `MediaRecorder` API. `frontend/src/app/components/voice-recorder/voice-recorder.component.ts` (line 46) instantiates `new MediaRecorder(stream)`.

## 4. Long Presses
Custom long press behaviour involves `(touchstart)` and `(touchend)` events. This pattern is verified in `frontend/src/app/components/long-press-context-menu/long-press-context-menu.component.spec.ts` (line 601) where `touchStartEvent` triggers are tested.

## 5. Keyboard Behaviour
Keyboard events are intercepted and handled across components. `frontend/src/app/components/forced-update-modal/forced-update-modal.component.ts` blocks `Escape` and `Esc` keys (line 109).

## 6. Scrolling
Scrolling is managed with specific overflow utility classes. `frontend/src/app/components/correction-modal/correction-modal.component.html` pairs `overflow-y-auto` with `overscroll-contain` (line 35). Global `overscroll-behavior-y: none;` is configured in `frontend/src/styles.scss` (line 113).

## 7. Overlays & Modal Stacking
Modals and overlays utilise specific positioning and layout utility classes. A verified example is `frontend/src/app/app.component.html` (line 143), which employs `class="fixed bottom-0 inset-x` to structure mobile overlays and bars.

## 8. Back Navigation
Back navigation incorporates native history APIs. `frontend/src/app/components/gdpr/gdpr.component.ts` explicitly calls `window.history.back()` (line 151).

## 9. Transitions
Transitions provide visual feedback. The `transition-colors` utility is verified in `frontend/src/app/app.component.html` (lines 51, 63, 79).
