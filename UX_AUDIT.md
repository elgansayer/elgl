# Mobile UI Audit Report (Test Plan & Hypotheses)

This report outlines the unverified static assumptions found during code inspection and provides a concrete validation plan for active runtime verification. Static presence of CSS or APIs is not proof of mobile behavior; actual reproducible runtime results are required before marking any of these as verified.

## 1. Thumb Reach
- **Observation (Hypothesis):** The primary navigation is pinned to the bottom of the screen via `app-navigation-tabs` (`app.component.html:143`, using classes `fixed bottom-0`).
- **Validation Plan:** Execute manual device testing across a standard device matrix (e.g., standard iOS and Android form factors) to confirm all primary actions are comfortably reachable with a single hand without straining. Record pass/fail per device.
- **Severity:** High (Unverified core navigation).

## 2. Keyboard Behaviour
- **Observation (Hypothesis):** The application provides a global skip-to-content link for keyboard users (`app.component.html:120`). Interactive elements utilize `focus-visible` styling (`styles.scss:136`).
- **Validation Plan:** Connect a physical Bluetooth keyboard to test devices. Navigate the core flow using only keyboard controls (`Tab`, `Space`, `Enter`, `Escape`). Verify focus rings are clearly visible on every interactive element and that modals trap focus correctly.
- **Severity:** High (Unverified accessibility requirement).

## 3. Scrolling & Overscroll
- **Observation (Hypothesis):** The root application layout leverages `min-h-[100dvh]` (`app.component.html:2`).
- **Validation Plan:** Open the application in standard mobile browsers. Scroll aggressively past the top and bottom boundaries. Verify that browser chrome (address bar) retracts smoothly and that scrolling does not chain to the underlying page (rubber-banding).
- **Severity:** Medium (Unverified layout stability).

## 4. Overlays & Modal Stacking
- **Observation (Hypothesis):** A deliberate Z-index hierarchy is defined at the layout level (`app.component.html`): `z-50` for the bottom navigation, `z-[100]` for lightboxes, and `z-[11000]` for critical forced update modals. Semantic modals utilize `@spartan-ng/helm/dialog`.
- **Validation Plan:** Trigger multiple overlapping modals simultaneously. Verify that the critical modal appears on top, focus is trapped in the topmost modal, and dismissing one does not dismiss others unintentionally.
- **Severity:** Medium (Unverified Z-index stacking).

## 5. Safe Areas
- **Observation (Hypothesis):** Safe areas are implemented natively using CSS environment variables (`styles.scss:117-119`).
- **Validation Plan:** Test on devices with notches or hardware cutouts in both portrait and landscape orientations. Verify that no text, buttons, or navigation elements are obscured by the notch or the bottom home indicator.
- **Severity:** High (Unverified content visibility).

## 6. Back-Navigation
- **Observation (Hypothesis):** The application uses the standard Angular router for view management. Dialogs support dismissal via the `Escape` key.
- **Validation Plan:** Navigate multiple levels deep into the app. Use the native OS back gestures (Android physical back button, iOS edge-swipe). Verify the app navigates back exactly one logical view state per gesture without unexpectedly exiting the application.
- **Severity:** High (Unverified OS integration).

## 7. Touch Targets
- **Observation (Hypothesis):** Navigation tab items enforce a `w-16` width (`app.component.html`), and standard icon buttons use `p-2`.
- **Validation Plan:** Use browser developer tools and physical devices to inspect the computed height and width of all primary buttons and navigation icons. Verify they meet the minimum 44x44pt (iOS) or 48x48dp (Android) guidelines. Record any elements that fail this check for remediation.
- **Severity:** High (Unverified accessibility standard).

## 8. Media Capture & Voice Recording
- **Observation (Hypothesis):** Media capture relies directly on native Web APIs (`navigator.mediaDevices.getUserMedia`) for audio (`audio-recorder.component.ts:47`) and video (`instant-video-recorder.component.ts:162`).
- **Validation Plan:** Test on physical devices. Trigger voice and video capture. Verify that native OS permission prompts appear correctly, that the device switches to the correct camera/microphone, and that the resulting stream functions without severe lag.
- **Severity:** High (Unverified hardware integration).

## 9. Long Presses
- **Observation (Hypothesis):** Global styles are configured to disable default text selection and touch callouts (`user-select: none`, `-webkit-touch-callout: none` in `styles.scss:115-116`).
- **Validation Plan:** Enable OS screen readers (e.g., VoiceOver, TalkBack). Attempt to interact with elements and copy text. Verify that the `user-select: none` rule does not silence screen readers or prevent users from performing intended copy/paste actions.
- **Severity:** High (Unverified accessibility impact).

## 10. Transitions
- **Observation (Hypothesis):** Interaction states (hover, focus) are provided using standard CSS transitions.
- **Validation Plan:** Enable "Reduce Motion" in the OS accessibility settings. Navigate the app and trigger animations. Verify that all non-essential CSS transitions are disabled or simplified, respecting the user's preference.
- **Severity:** Medium (Unverified accessibility preference).
