# Mobile Application Audit Report

## 1. Thumb Reach
- **Observation:** The application employs a bottom navigation bar (`fixed bottom-0 pb-safe`), floating action buttons (e.g., `fixed bottom-20 end-4` in `groups-discovery`), and bottom sheets (e.g., `fixed bottom-0 ... max-h-80` in `wallpaper-picker`). These elements are well-positioned for thumb reach on mobile devices.
- **Recommendations:** Ensure that frequently used actions in modals/sheets (e.g., save, close) are placed near the bottom rather than the top corners, and verify the `bottom-[76px]` position of the `conversation-analysis-launcher` avoids overlapping the bottom navigation bar.

## 2. Keyboard Behaviour
- **Observation:** Inputs (`input`, `textarea`, `[contenteditable="true"]`) correctly apply `select-text` and `-webkit-user-select: text`, allowing default mobile keyboard behavior.
- **Recommendations:** Verify that interactive overlays resize correctly or pad content when the mobile keyboard is summoned to prevent inputs from being obscured, as standard fixed layouts often fail to account for the Virtual Keyboard API without explicit safe area or viewport height adjustments (`100dvh` is used, which is good).

## 3. Scrolling
- **Observation:** Scrolling is managed via utility classes like `overflow-y-auto`. Overlays (e.g., `lightbox`) use `touch-pan-y` and `overscroll-none` to prevent body scrolling while the modal is open.
- **Recommendations:** For horizontal scrolling lists (e.g., carousels, tabs), verify the use of `scroll-snap-type` to improve the mobile touch experience. Consider adding `-webkit-overflow-scrolling: touch` (or verifying its implicit application via Tailwind) for smoother native scrolling on iOS.

## 4. Overlays & Modal Stacking
- **Observation:** Z-indices are heavily used (e.g., `z-[9999]`, `z-[11000]`, `z-50`). There is a wide range of custom stacking contexts created via `fixed inset-0`.
- **Recommendations:** A formalized z-index scale (e.g., CSS variables) would prevent conflicts (like the `forced-update-modal` at `11000` competing with `app-lock` at `9999`). Ensure all overlays trap focus and prevent underlying scrolling (`cdkScrollBlock` or manual body class).

## 5. Safe Areas
- **Observation:** Safe areas are explicitly handled in `styles.scss` using `env(safe-area-inset-*)` and applied contextually via utility classes like `pb-safe`.
- **Recommendations:** Verify `pt-safe` usage for headers to prevent overlapping with notches or status bars on modern devices, especially inside full-screen modals.

## 6. Back-navigation
- **Observation:** The application relies on Angular's routing and `location.back()` or `history.back()`.
- **Recommendations:** Implement interception of the physical Android back button (or swipe-to-go-back gesture on iOS) for custom overlays/modals to close them instead of navigating the entire route back.

## 7. Touch Targets
- **Observation:** Primary buttons and interactive elements generally use `min-h-11` (`44px`) or `w-12 h-12` (`48px`), aligning with mobile accessibility standards (e.g., WCAG 44x44px, Material 48x48px).
- **Recommendations:** Ensure inline links, icon buttons, and close buttons within complex UI components (like chat items or small chips) also meet the minimum `44px` physical touch area, even if visually smaller, using padding or transparent borders.

## 8. Media Capture & Voice Recording
- **Observation:** The `draft.service` and media sharing components handle audio/video/image contexts.
- **Recommendations:** Ensure the camera/microphone permission flows gracefully handle denial states and provide clear fallback UI on mobile. Verify that `accept="image/*,video/*"` prompts the native mobile file picker with camera/gallery options correctly.

## 9. Long Presses
- **Observation:** Long presses are implemented via `(touchstart)` and `(touchend)` alongside `(contextmenu)` (e.g., `long-press-context-menu`).
- **Recommendations:** Ensure long-press actions do not trigger the default mobile context menu or text selection (`-webkit-touch-callout: none` is correctly set globally in `styles.scss`).

## 10. Transitions
- **Observation:** The app uses Tailwind transition utilities (`transition-colors`, `transition-transform duration-300 ease-in-out`).
- **Recommendations:** For mobile, prefer transforming opacity and transform properties over width/height or layout properties to ensure 60fps hardware acceleration and avoid jank during navigation or modal reveals.
