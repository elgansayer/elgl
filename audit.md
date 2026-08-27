# Mobile UI Audit Report

This report provides an evidence-based audit of the mobile social application interface, referencing specific implementations and identifying actionable remediation where necessary.

## 1. Thumb Reach
- **Observation:** The primary navigation is pinned to the bottom via `app-navigation-tabs` (`app.component.html:143`, `fixed bottom-0`).
- **Defect/Gap:** Top header actions (e.g., search or profile menus) are currently placed at the top of the screen (`app.component.html:43`). On large devices, this requires adjusting grip to reach.
- **Remediation:** Consider moving secondary global actions into a bottom sheet accessible from the navigation bar, or implement a pull-down-to-reach gesture.

## 2. Keyboard Behaviour
- **Observation:** A skip-to-content link exists for keyboard users (`app.component.html:120`). Focus rings are globally applied (`styles.scss:136`, `.focus-visible`).
- **Defect/Gap:** While Spartan primitives retain native keyboard support, some custom components like `long-press-context-menu` expose synthetic keyboard alternatives that require explicit maintenance (`long-press-context-menu.component.spec.ts:491`).
- **Remediation:** Ensure all custom interactive elements without native equivalents (like `div` or `span` buttons) strictly use Relay semantic tokens and delegate to `hlmBtn` or `a11y-clickable.ts` to guarantee uniform keyboard focus and activation without custom script overhead.

## 3. Scrolling & Overscroll
- **Observation:** Layouts use `min-h-[100dvh]` to handle browser chrome dynamically (`app.component.html:2`). `overscroll-contain` is heavily used in dialogs (`report-user-modal.component.html:36`, `correction-modal.component.html:35`).
- **Defect/Gap:** Some scrollable inner containers might not explicitly prevent scroll chaining on all mobile browsers, leading to accidental pull-to-refresh.
- **Remediation:** Ensure `overscroll-behavior-y: contain` is systematically applied to all scrollable modals and bottom sheets.

## 4. Overlays & Modal Stacking
- **Observation:** Z-index hierarchy is defined (`app.component.html`): `z-50` for nav, `z-[100]` for lightbox, `z-[11000]` for forced updates. Modals use `@spartan-ng/helm/dialog`.
- **Defect/Gap:** Unmanaged stacking can occur if multiple independent overlays are triggered simultaneously (e.g., incoming call modal over a settings dialog).
- **Remediation:** Implement a global overlay manager or strictly enforce a single-active-overlay policy at the application state level.

## 5. Safe Areas
- **Observation:** Safe areas are implemented using native CSS environment variables (`env(safe-area-inset-top)`, etc.) in `styles.scss:117-119` and `.pb-safe` utilities.
- **Defect/Gap:** The `tailwindcss-safe-area` plugin is incompatible with Tailwind v4, meaning developers must manually apply `env()` or custom utility classes everywhere safe areas are needed.
- **Remediation:** Ensure a strict linting rule or custom Tailwind plugin is created to automatically map `env(safe-area-inset-*)` to standard padding utilities (e.g., `p-safe`) to prevent regressions.

## 6. Back-Navigation
- **Observation:** Angular routing is used. Dialogs close via the `Escape` key (`hlm-dialog`).
- **Defect/Gap:** Native swipe-to-back on iOS/Android handles standard routes, but modal dismissals via swipe-down or edge-swipe are not natively supported by the standard router or `hlm-dialog` without custom gesture recognition.
- **Remediation:** Integrate a bottom-sheet library (or extend Helm dialogs) with native touch-pan physics for swipe-to-dismiss capabilities.

## 7. Touch Targets
- **Observation:** Touch targets generally use sufficient padding/sizing (e.g., `w-16` for tab items, `p-2 rounded-full` in `app.component.html:63`).
- **Defect/Gap:** Some inline links or smaller utility buttons might fall below the minimum 44x44pt recommendation for mobile touch targets.
- **Remediation:** Audit all inline actionable elements (`a`, `button`) inside rich text or secondary panels and enforce a minimum `min-h-11 min-w-11` touch area, using transparent borders or padding if necessary.

## 8. Media Capture & Voice Recording
- **Observation:** Native `navigator.mediaDevices.getUserMedia` is used for audio/video (`audio-recorder.component.ts:47`, `instant-video-recorder.component.ts:162`). Audio is compressed client-side (`AudioCompressionService`).
- **Defect/Gap:** Hardware permissions can be denied or revoked.
- **Remediation:** Ensure robust, user-friendly fallback states and explainer copy exist before requesting `getUserMedia`, rather than just catching the rejection silently.

## 9. Long Presses
- **Observation:** Custom long-press actions are handled by `LongPressContextMenuComponent`.
- **Defect/Gap:** Global mobile styling (`user-select: none`, `-webkit-touch-callout: none` in `styles.scss:115-116`) is necessary to prevent default browser menus on long press.
- **Remediation:** Ensure inputs, textareas, and contenteditable elements are strictly whitelisted (`input, textarea, [contenteditable="true"] { user-select: text; -webkit-touch-callout: default; }`) to prevent breaking native text entry and cursor placement.

## 10. Transitions
- **Observation:** `transition-colors` is widely used for interactive feedback.
- **Defect/Gap:** Page-level transitions (e.g., slide-in from right for deep navigation) are not explicitly managed by the Angular router setup observed, making the app feel more like a website than a native app.
- **Remediation:** Implement Angular View Transitions or standard router animation wrappers to provide native-like page sliding and modal entering animations.
