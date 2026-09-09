# Mobile Social Application Audit Report

## 1. Safe Areas
The application correctly utilizes `env(safe-area-inset-*)` CSS variables globally on `html` and `body` tags (found in `frontend/src/styles.scss` lines 117-119). It also properly mirrors them for RTL layouts (lines 132-133).

## 2. Z-Index and Overlays
- Lightbox uses `z-[100]` and `z-[110]` (`frontend/src/app/components/lightbox/lightbox.component.html`)
- Modals like App Language Selector (`z-[110]`), Language Picker (`z-[120]`) and Moments Feed Overlay (`z-[100]`) exist.
- Overlays like Incoming Call (`z-[9999]`), No Network Banner (`z-[10000]`), and Forced Update (`z-[11000]`) exist.
Modal stacking logic is present across these high z-indexes.

## 3. Scrolling and Overscroll
Overscroll behaviours are well-managed in containers:
- Global `overscroll-behaviour-y: none;` on body/html in `styles.scss`
- Lightbox component applies `touch-pan-y overscroll-none` (`frontend/src/app/components/lightbox/lightbox.component.html`)
- UI elements (autocomplete, combobox, report user modal) apply `overscroll-contain` or `overscroll-behaviour-inline: contain` to isolate scrolling.

## 4. Touch Targets
There are a number of small touch targets, often 14x14px (`w-3.5 h-3.5`), 16x16px (`w-4 h-4`) or 20x20px (`w-5 h-5`), found in:
- `frontend/src/app/components/voiceroom-create-modal/voiceroom-create-modal.component.ts` (checkbox 16x16)
- `frontend/src/app/components/word-definition-modal/word-definition-modal.component.ts` (SVG 20x20)
- `frontend/src/app/components/chat-message/chat-message.component.ts` (several `w-3.5 h-3.5` elements and an SVG `w-5 h-5`)
- `frontend/src/app/components/chat-list/chat-list.component.html` (`w-7 h-7` element)
These are smaller than the recommended 44x44px mobile touch target size.

## 5. Long Presses
The app implements long presses and context menus:
- `flashcard-context-menu.directive.ts` handles `(contextmenu)` natively.
- `long-press-context-menu.component.ts` handles long press natively via `(contextmenu)`.

## 6. Voice / Media Capture
The application extensively uses `navigator.mediaDevices.getUserMedia` for audio/video capture across:
- `instant-video-recorder.component.ts`
- `pronunciation-feedback.component.ts`
- `voice-recorder.component.ts`
- `audio-intro-recorder.component.ts`
- `audio-recorder.component.ts`
- `permission.service.ts`

## 7. Back Navigation
Keyboard accessibility and some focus-restoring behaviours were found, but explicit native back navigation behaviours for modals (like pushing history state) require deeper application-level review for proper mobile stacking teardown.

## 8. Transitions
Transitions (`transition-colours`) are used extensively across the app (like `frontend/src/app/app.component.html`), mostly for hover effects which are primarily applicable to desktop cursors rather than mobile touch inputs.

## 9. Thumb Reach (Bottom Nav / Sheets)
The bottom navigation bar correctly lives at the bottom of the screen (`bottom-0` and `pb-safe`) ensuring strong thumb accessibility.
"Sheet" components use `rounded-sheet`, indicating modal presentation that's mobile-first.

## Conclusion
The application generally handles mobile considerations well (safe areas, scrolling isolation), but has areas for improvement:
1. Touch targets (some are 14x14px and 20x20px, far below standard 44x44px).
2. Modals may not natively pop states from the hardware back button.
3. Transitions are mostly hover-based.
