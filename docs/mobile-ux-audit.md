# Mobile UX Audit Report

This document outlines the findings of a mobile-first UX audit of the HelloTalk AI Clone, evaluating the application as an actual mobile social application rather than a responsive website.

## Findings

### 1. Safe Areas (Notches & Home Indicators)
- **Issue:** No `safe-area-inset-*` (e.g., `env(safe-area-inset-bottom)`) CSS variables are used anywhere in `frontend/src`.
- **Impact:** Critical for PWA/mobile web. Content will overlap with hardware notches or the bottom home indicator on modern devices (iOS/Android).

### 2. Touch Targets (Thumb Reach)
- **Issue:** Very few instances of `min-h-11` or `min-h-12` (44px/48px minimums) found across interactive components, except in basic Spartan primitives like `button-primary`. Custom chat actions, user discovery cards, and share modals often use smaller padding/height.
- **Impact:** Fails mobile accessibility standards for touch targets. Users will struggle with thumb precision.

### 3. Media Capture (Native Camera/Microphone)
- **Issue:** The application lacks the `capture` attribute (e.g., `capture="environment"` or `capture="user"`) on `<input type="file">` elements.
- **Impact:** Mobile users will see a generic file picker instead of launching directly into the native camera or microphone interface, breaking the native social app feel.

### 4. Input Modes (Mobile Keyboard Behavior)
- **Issue:** `inputmode` attributes (e.g., `inputmode="numeric"`, `inputmode="email"`) are missing across forms.
- **Impact:** The OS will not show optimized virtual keyboards (like showing a number pad for OTPs or `@` key for emails), causing friction.

### 5. Over-scrolling & Pull-to-refresh
- **Issue:** Minimal `overscroll-behavior` control. `overscroll-contain` is only used in autocomplete/combobox and a single report modal.
- **Impact:** Users will accidentally trigger browser-level pull-to-refresh or overscroll the whole PWA canvas instead of just the intended scrollable container (e.g., a chat list).

### 6. Back-Navigation & Modal Stacking
- **Issue:** No custom `popstate` listeners found to intercept the hardware back button or Android back gesture.
- **Impact:** If a user opens a modal/overlay and presses the physical back button, it will likely navigate them away from the current page entirely rather than just dismissing the top-most modal in the stack.

### 7. View Transitions
- **Issue:** The View Transitions API (`view-transition-name`) is absent.
- **Impact:** Navigation between routes feels like a hard page reload (web app) rather than smooth, native-like spatial transitions (mobile app).

### 8. Voice Recording & Long Presses
- **Status:** Voice recording capabilities using `MediaRecorder` and `navigator.mediaDevices.getUserMedia` are implemented in `frontend/src/app/audio-intro/audio-intro-recorder.component.ts` and `frontend/src/app/components/audio-recorder/audio-recorder.component.ts`. However, custom `contextmenu` / long-press interactions for quick actions (common in chat apps) appear to be missing or under-utilized.
