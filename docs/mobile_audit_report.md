# Mobile Application Audit Report

## 1. Thumb Reach & Touch Targets
- Most bottom navigation icons in `app.component.html` have adequate touch targets (60px height nav).
- The `min-h-[*]` utility is used inconsistently across interactive components. While `min-h-[44px]` (meeting standard mobile touch target size) is seen in `reading-engine.component.ts` (min-h-[44px] sm:min-h-0), `min-h-[40px]` and `min-h-[36px]` are commonly used for buttons in `resource-library.component.ts`, which might be slightly small for some users.

## 2. Keyboard Behaviour
- The application uses `a11y-clickable` and Spartan UI primitives (`hlmBtn`, `hlmInput`, etc.) to map generic interactive elements to native keyboard behaviours.
- There are specific blockings for `Escape` in modals like `forced-update-modal.component.ts`.
- `inputmode` and `enterkeyhint` are missing across forms in the `frontend/src/app` directory, meaning virtual keyboards won't optimise correctly for specific input types (e.g., numeric, search, next/done actions).

## 3. Scrolling & Overscroll
- Overflow control (`overflow-y-auto`, `overflow-x-auto`) is used extensively.
- `overscroll-contain` is used in some components (e.g., `report-user-modal.component.html`, `hlm-combobox-list.ts`), but not universally applied to all scrollable overlays, which might lead to scroll chaining on mobile devices.
- `touch-pan-y` is explicitly defined in `lightbox.component.html`, suggesting some attention to touch-based scrolling interactions.

## 4. Overlays & Modal Stacking
- Various z-indexes are used (`z-10`, `z-20`, `z-40`, `z-50`, `z-[60]`, `z-[100]`, `z-[110]`), indicating a complex modal stacking context.
- Modals generally use a fixed full-screen overlay (`fixed inset-0`) with a dark backdrop (`bg-black/50`, `bg-black/60`).
- The `lightbox.component.html` uses `z-[100]` and `z-[110]`, placing it above standard `z-50` overlays.

## 5. Safe Areas
- The bottom navigation bar in `app.component.html` incorporates `pb-safe` to account for home indicators on devices like iPhones.
- Top safe areas (`pt-safe`) are absent in the main components, which might cause content to overlap with the status bar or notch on certain devices.

## 6. Back-Navigation
- There's no evident explicit handling of swipe-to-go-back or hardware back button interactions globally mapped to Angular's router in the core app component.

## 7. Media Capture & Long Presses
- `MediaRecorder` is implemented in components like `voice-recorder.component.ts`, `pronunciation-feedback.component.ts`, and `audio-intro-recorder.component.ts`. They mock this in tests.
- A specific `long-press-context-menu` component exists, confirming support for long-press interactions, which are typical in mobile applications.

## 8. Transitions
- A large number of transitions (419 instances) exist, relying on standard Tailwind utilities (`transition-colors`, `transition-transform`) for state changes.
