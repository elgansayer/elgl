# Mobile Native Application UX/UI Audit

**Date:** 2026-08-16
**Scope:** Evaluating the HelloTalk Open-Core Platform (Angular/Tailwind) as if it were a native mobile social application.

## 1. Safe Areas & Viewport
- **Current State:** The application utilizes `<meta name="viewport" content="width=device-width, initial-scale=1" />` in `frontend/src/index.html`. The CSS class `.pb-safe` is applied to the mobile bottom navigation bar in `app.component.html`, but no corresponding CSS definition (`padding-bottom: env(safe-area-inset-bottom)`) exists in the core stylesheets (`styles.scss` or `tailwind.config.js` plugins).
- **Audit Finding:** The viewport meta tag lacks `viewport-fit=cover`, causing the app to render within the safe area bounds by default on iOS, rendering `.pb-safe` ineffective. Devices with notches or home indicators will display letterboxing at the top/bottom edges instead of a full-bleed edge-to-edge layout expected of modern mobile apps.
- **Recommendation:** Add `viewport-fit=cover` to `index.html`. Implement `safe-area-inset-*` utility classes globally in Tailwind/CSS to handle padding dynamically.

## 2. Touch Targets & Thumb Reach
- **Current State:** `frontend/src/app/components/ui/button/src/lib/hlm-button.ts` correctly defines a `touch: 'min-h-11 gap-2 px-4 py-2.5'` size variant, mapping to the ~44px mobile touch target standard.
- **Audit Finding:** The mobile bottom navigation uses a generous `h-[60px]` height, ensuring primary navigation is within easy thumb reach. However, high-frequency actions scattered throughout feature components relying on default button sizing risk violating touch target minimums if they don't explicitly opt-in to the `touch` size.
- **Recommendation:** Enforce `size="touch"` or equivalent 44px minimums on all primary interactive elements on mobile viewports. Consider shifting critical secondary actions (like compose or search) from top headers to floating action buttons (FABs) or bottom sheet menus.

## 3. Keyboard Behaviour
- **Current State:** The application relies on default browser handling for virtual keyboard appearances.
- **Audit Finding:** When a user taps an input (e.g., the chat message composer), the native virtual keyboard pushes the entire viewport up. For fixed-position elements (like the bottom nav bar or sticky headers), this can cause layout thrashing, where headers are pushed off-screen or the composer is obscured. The lack of the VirtualKeyboard API means the app cannot transition smoothly.
- **Recommendation:** Implement the VirtualKeyboard API (where supported) or leverage visual viewport resize event listeners to adjust padding dynamically rather than relying on standard window resize events, preventing UI squishing.

## 4. Scrolling & Overscroll
- **Current State:** Specific elements like `hlm-autocomplete-list` utilize `overscroll-contain` to prevent scroll chaining.
- **Audit Finding:** Native mobile apps employ "rubber-banding" or bouncy scrolling at the boundaries of lists. Webviews on iOS natively support this, but complex nested scrolling containers without `-webkit-overflow-scrolling: touch` (historically, though now mostly default) or proper `overscroll-behavior` can feel rigid or cause the entire page body to bounce unintentionally instead of just the inner list (e.g., chat message history).
- **Recommendation:** Audit all scrollable containers (especially `overflow-y-auto`) to ensure `overscroll-behavior-y: contain` is applied to prevent the parent body from rubber-banding when the child hits its scroll boundary.

## 5. Overlays & Modal Stacking
- **Current State:** The application delegates dialogs to `@spartan-ng/brain/dialog`, which handles focus trapping, backdrop rendering, and escape-key dismissal.
- **Audit Finding:** Spartan handles single dialogs well. However, in a social app, opening a profile from a chat, then opening an image from that profile creates a deeply stacked modal state. Without a robust z-index management system or multiple router outlets, stacking dialogs can lead to broken backdrops or trapped focus on mobile.
- **Recommendation:** Implement a global overlay manager or utilize nested routes for complex overlays (like user profiles) rather than stacking raw dialog components, ensuring the back button unwinds the stack sequentially.

## 6. Back-Navigation
- **Current State:** Navigation relies on standard Angular routing and the browser's history API.
- **Audit Finding:** Native iOS applications allow edge-swiping from the left to pop the current view off the navigation stack seamlessly. A standard Angular web app lacks this gesture-driven back navigation out of the box, feeling immediately "web-like."
- **Recommendation:** Integrate a gesture library (like Hammer.js or native touch events) to detect edge swipes and trigger `Location.back()`, coupled with page-level transition animations to mimic native stack popping.

## 7. Transitions
- **Current State:** CSS transitions are defined globally (`--app-motion-fast: 140ms`, `--app-motion-base: 180ms`, `--app-motion-slow: 260ms` in `styles.scss`).
- **Audit Finding:** These cover micro-interactions (button presses, hover states). However, macro-transitions (navigating from a chat list to a chat room) lack the standard push/slide animations expected in mobile OS environments.
- **Recommendation:** Implement Angular route transition animations (e.g., sliding pages in from the right) using `@angular/animations` to replicate the spatial model of a native app.

## 8. Media Capture & Voice Recording
- **Current State:** The app has multimedia features (based on the `chat-page.component.ts` allowing media viewing and voice/text interaction like the AI partner).
- **Audit Finding:** Relying purely on `<input type="file" accept="image/*" capture="camera">` for media often provides a clunky native OS camera view. Voice recording via the MediaRecorder API requires explicit permission handling and can fail silently or be interrupted by incoming native phone calls without proper visibility API management.
- **Recommendation:** Ensure robust error handling for MediaDevices permissions. Implement background audio ducking logic and handle `visibilitychange` events gracefully if a user switches apps during a recording.

## 9. Long Presses
- **Current State:** A `long-press-context-menu.component.ts` component exists.
- **Audit Finding:** Standard web applications trigger text selection or the native OS context menu on long presses. If the custom component doesn't aggressively `preventDefault()` on `contextmenu` and `touchstart`/`touchend` timings, users will accidentally trigger native OS magnifying glasses or copy/paste toolbars instead of the app's custom message actions.
- **Recommendation:** Verify that the `long-press-context-menu` explicitly disables user-select (`user-select: none; -webkit-user-select: none;`) on its target elements and intercepts the native `contextmenu` event.
