# Mobile Experience Audit

## Thumb Reach
- **Implementation:** A bottom navigation bar is used in `frontend/src/app/app.component.html` on line 143 (`class="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-surface-200 border-t border-surface-100 pb-safe"`), which places primary navigation within easy thumb reach for mobile users.

## Keyboard Behaviour
- **Implementation:** The `frontend/src/index.html` file includes the viewport meta tag with `interactive-widget=resizes-content` (line 7), which ensures that the on-screen keyboard resizes the visual viewport rather than overlaying the content:
  `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />`

## Scrolling
- **Implementation:** The global stylesheet `frontend/src/styles.scss` uses `overscroll-behavior-y: none;` on line 113 to prevent the elastic bounce effect on the body. Scrollable components like the lightbox (`frontend/src/app/components/lightbox/lightbox.component.html` line 5) use `touch-pan-y overscroll-none` and modals like the correction modal (`frontend/src/app/components/correction-modal/correction-modal.component.html` line 35) use `<div class="p-4 overflow-y-auto overscroll-contain space-y-4 flex-1 min-w-0">` to trap scrolling within the component.

## Overlays & Modal Stacking
- **Implementation:** The app manages z-indexes manually with utility classes. Modals and overlays use various high z-indexes such as `z-[10000]` in `no-network-banner.component.ts` (line 10) and `z-[9999]` in `app.component.html` (line 10).

## Safe Areas
- **Implementation:** Safe areas are handled globally using CSS environment variables in `frontend/src/styles.scss` lines 117-119 (`padding-top: env(safe-area-inset-top);`, `padding-inline-start: env(safe-area-inset-left);`, `padding-inline-end: env(safe-area-inset-right);`). The `viewport-fit=cover` attribute is present in `index.html`.

## Back Navigation
- **Implementation:** Routing relies on the Angular router. The `Location` service from `@angular/common` is used for back navigation (e.g., `{ provide: Location, useValue: { back: goBack } }` seen in `frontend/src/app/pages/settings/privacy-settings/privacy-settings.component.spec.ts` line 72).

## Touch Targets
- **Implementation:** Touch targets meet the 44px minimum recommendation (Apple HIG). Instances of `min-h-[44px]` are found in components like `frontend/src/app/components/resource-library/resource-library.component.ts` line 183 (`class="bg-primary text-on-fill px-4 py-2 rounded-app text-sm font-semibold min-h-[44px]"`).

## Media Capture & Voice Recording
- **Implementation:** Standard Web APIs are utilized. The app leverages `MediaRecorder` (e.g., `frontend/src/app/components/voice-recorder/voice-recorder.component.ts` line 35: `private mediaRecorder: MediaRecorder | null = null;`).

## Long Presses
- **Implementation:** A dedicated component and directive handle long presses. The `LongPressContextMenuComponent` (`frontend/src/app/components/long-press-context-menu/long-press-context-menu.component.ts`) is integrated into chat features (`frontend/src/app/components/chat-message/chat-message.component.ts` line 6).
