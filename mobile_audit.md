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

# Mobile UI source audit

This is a source review, not a device test or accessibility certification. It does not establish measured touch-target sizes, frame times, keyboard visibility, thumb reach or browser Back behaviour. Source baseline: main at b613278fe70f743c45d6ea9e5a2a291c6015ab27.

| Area | Source to inspect | Required runtime evidence |
| --- | --- | --- |
| Navigation and thumb reach | `frontend/src/app/app.component.html` and navigation components | Reachability on small and large phones in portrait and landscape; bottom controls remain visible with the keyboard open. |
| Keyboard | Native form controls, skip link and focus styles in `frontend/src/styles.scss` | Logical focus order, visible focus, correct soft keyboard for each field, and no obscured submit action. |
| Scrolling | Scroll containers and modal overflow classes | Long content scrolls within the intended container without trapping users or unexpectedly moving the page. Absence of legacy momentum-scrolling CSS is not evidence of a defect. |
| Overlays | Owned Helm dialog components and their Brain primitives | Focus enters and returns correctly; stacking, inert background and dismissal work together. Do not assume Helm always renders a native HTML dialog. |
| Safe areas | `frontend/src/styles.scss` and viewport layout | Insets work on notched devices, installed mode, landscape and RTL without double padding. |
| Back navigation | Angular routes and per-dialog dismissal configuration | Test browser history, Android Back and iOS navigation separately. Escape handling does not prove any of these behaviours. The forced-update modal deliberately blocks Escape. |
| Touch targets | Outer interactive controls, including icon buttons and checkbox labels | Measure each clickable bounding box and spacing. SVG dimensions, padding names, border radius and `min-w-0` on a noninteractive bubble do not establish a control's hit area. |
| Media and voice | Recorder components using browser media APIs | Permission grant/denial, unsupported APIs, interruption, cancellation, track cleanup and upload recovery on supported browsers. Source use of getUserMedia does not prove these work. |
| Long press and selection | `long-press-context-menu` and `flashcard-context-menu.directive.ts` | Context menu can be opened and dismissed; scrolling and essential text selection remain usable. Global selection suppression is a trade-off, not proof of native quality. |
| Motion | Transition classes and reduced-motion rules | Check rendered motion and reduced-motion settings. CSS hooks alone do not establish frame rate or smoothness. |

CSS/API identifiers retain their actual spelling, including `overscroll-behavior` and `transition-colors`. British English applies to prose, not renamed platform APIs.

No claim is made that inputmode or enterkeyhint is present throughout the application. The previously cited discovery-search-bar and sms-verification examples were not substantiated. Audit actual form controls before recommending field-specific attributes.

The device matrix should include iOS Safari, Android Chrome, keyboard and screen-reader navigation, 320 CSS-pixel reflow, long translated text, RTL, light/dark themes and reduced motion. Record the build, device/browser, steps and measured result for each finding. Until that evidence exists, recommendations remain candidates for testing rather than confirmed defects or completed fixes.

