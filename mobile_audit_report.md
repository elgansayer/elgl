# Mobile Application Audit Report

## 1. Thumb Reach
- The bottom navigation bar (`app.component.html`) provides easy thumb access to primary tabs.
- The codebase uses padding on classes like `.app-button-primary` and `.app-button-secondary` (`styles.scss`) to improve thumb interactions.

## 2. Keyboard Behaviour
- The global viewport meta tag in `index.html` includes `interactive-widget=resizes-content`, which allows the content to resize properly when the virtual keyboard appears, avoiding the keyboard overlapping critical inputs.
- Input elements (`input`, `textarea`, `[contenteditable="true"]`) have `user-select: text` to allow proper text entry.

## 3. Scrolling
- `styles.scss` uses `overscroll-behavior-y: none;` on `html, body`, which prevents the entire application from "bouncing" when scrolling past the top or bottom bounds, a common issue in mobile web apps that makes them feel less native.
- `overscroll-contain` is used inside specific scrollable areas (e.g., `correction-modal.component.html`) to prevent scroll chaining (where reaching the end of the modal scrolls the underlying body).
- The `no-scrollbar` utility is applied to `.app-filter-scroll` for horizontal tabs, hiding the native scrollbar for a cleaner look.

## 4. Overlays & Modal Stacking
- Z-index usage includes `z-[100]` for lightbox (`lightbox.component.html`). The lightbox uses `!h-dvh !w-screen !max-w-none` to ensure it covers the entire viewport.
- The `overscroll-none` on the lightbox prevents background scrolling while it is open.

## 5. Safe Areas
- `styles.scss` uses `env(safe-area-inset-top)`, `env(safe-area-inset-left)`, and `env(safe-area-inset-right)` on the `html, body` tags to respect device notches and rounded corners.
- RTL (Right-to-Left) mirroring correctly swaps `safe-area-inset-left` and `safe-area-inset-right` for physical screen safe areas in `styles.scss`.

## 6. Back-Navigation
- Standard web apps rely on router and browser history. Special handling is needed so that back edge-swipes close modals/overlays rather than navigating the main page back.

## 7. Touch Targets
- Buttons and inputs have padding (`pt-2.5 pb-2.5`, `pt-3 pb-3` in `.app-input`/`.app-textarea`) to ensure they are comfortably tappable.

## 8. Media Capture
- `voice-recorder.component.ts` and `audio-intro-recorder.component.ts` use `navigator.mediaDevices.getUserMedia({ audio: true })` for voice recording.
- They handle permission denial and missing APIs gracefully by throwing errors or showing toasts.
- `AudioIntroRecorderComponent` keeps a previous local recording valid if a subsequent attempt to start the microphone fails (e.g., permission denied).

## 9. Long Presses & Context Menus
- `FlashcardContextMenuDirective` (`flashcard-context-menu.directive.ts`) and `LongPressContextMenuComponent` (`long-press-context-menu.component.ts`) implement long-press detection using `setTimeout` triggered on `contextmenu` events.
- `FlashcardContextMenuDirective` correctly clears the timer on various events to prevent false triggers.
- The CSS rule `-webkit-touch-callout: none;` in `styles.scss` prevents the native context menu from appearing, allowing the custom long-press menu to function cleanly.

## 10. Voice Recording
- The `AudioIntroRecorderComponent` enforces a max duration (30 seconds) and stops automatically.
- It manages object URLs (`URL.createObjectURL`) for preview playback and correctly revokes them to prevent memory leaks.

## 11. Transitions
- `styles.scss` defines animations like `animate-fadeIn` and `content-state-enter` to make the UI feel responsive and native.
- The `.app-button-primary` uses `transition-all duration-base ease-app` for interaction feedback.
