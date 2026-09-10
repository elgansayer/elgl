# Mobile UI Audit Report

This report provides an evidence-based audit of the mobile application interface, documenting verified implementations based strictly on the current codebase.

## 1. Thumb Reach
- **Observation (Verified):** The primary navigation is pinned to the bottom of the screen via the `<nav>` element (`frontend/src/app/app.component.html:143`, using classes `fixed bottom-0`). This implementation places core routing navigation within standard mobile thumb reach.
- **Severity:** N/A (Functioning as intended).

## 2. Keyboard Behaviour
- **Observation (Verified):** The application provides a global skip-to-content link for keyboard users (`frontend/src/app/app.component.html:120`, using `focus:not-sr-only`). Global interactive elements utilise `focus-visible` styling (`frontend/src/styles.scss:137`) to present keyboard focus rings without interfering with touch interactions.
- **Severity:** N/A (Functioning as intended).

## 3. Scrolling & Overscroll
- **Observation (Verified):** The root application layout leverages `min-h-[100dvh]` (`frontend/src/app/app.component.html:2`) to adapt dynamically to mobile browser chrome (e.g., address bar expansion/retraction). Modals explicitly implement `overscroll-contain` (e.g., `frontend/src/app/components/report-user-modal/report-user-modal.component.html:36`, `frontend/src/app/components/correction-modal/correction-modal.component.html:35`) to trap scrolling and prevent chaining to the main page.
- **Severity:** N/A (Functioning as intended).

## 4. Overlays & Modal Stacking
- **Observation (Verified):** A deliberate Z-index hierarchy is defined at the layout level (`frontend/src/app/app.component.html`): `z-50` for the bottom navigation, `z-[100]` for lightboxes (`frontend/src/app/components/lightbox/lightbox.component.html`), and `z-[11000]` for critical forced update modals (`frontend/src/app/components/forced-update-modal/forced-update-modal.component.ts`). Semantic modals utilise `hlm-dialog` to handle layering.
- **Severity:** N/A (Functioning as intended).

## 5. Safe Areas
- **Observation (Verified):** Safe areas are implemented natively using CSS environment variables. Global padding rules (`frontend/src/styles.scss:117-119`) apply `env(safe-area-inset-top)` and corresponding logical directions to prevent content from rendering beneath mobile notches or home indicators.
- **Severity:** N/A (Functioning as intended).

## 6. Back-Navigation
- **Observation (Verified):** The application uses the standard Angular router for view management. All semantic dialogs (`hlm-dialog`) correctly support dismissal, mapping properly to keyboard accessibility guidelines.
- **Severity:** N/A (Functioning as intended).

## 7. Touch Targets
- **Observation (Verified):** Primary interactive elements satisfy touch target guidelines. For example, navigation tab items enforce a `w-16` width (`frontend/src/app/app.component.html:153`) to create sufficient hit areas.
- **Severity:** N/A (Functioning as intended).

## 8. Media Capture & Voice Recording
- **Observation (Verified):** Media capture relies directly on native Web APIs (`navigator.mediaDevices.getUserMedia`) for audio (`frontend/src/app/components/audio-recorder/audio-recorder.component.ts:47`) and video (`frontend/src/app/components/instant-video-recorder/instant-video-recorder.component.ts:162`).
- **Severity:** N/A (Functioning as intended).

## 9. Long Presses
- **Observation (Verified):** Long press interactions are captured via `LongPressContextMenuComponent`. To support this on mobile without triggering native selection loops, global styles are configured to disable default text selection and touch callouts (`user-select: none`, `-webkit-touch-callout: none` in `frontend/src/styles.scss:115-116`), while explicitly permitting selection inside text inputs (`frontend/src/styles.scss:124-125`).
- **Severity:** N/A (Functioning as intended).

## 10. Transitions
- **Observation (Verified):** Interaction states (hover, focus) are provided using standard CSS transitions (e.g., `transition-colors` on utility buttons in `frontend/src/app/app.component.html:153`).
- **Severity:** N/A (Functioning as intended).
