# Check memory: "When explicitly instructed to 'Audit' behaviors or features, you must generate and output a full written audit report document to a file in the workspace. If the instruction also includes actionable verbs like 'Build' or 'Implement', you must BOTH generate the audit report and implement the functional code changes."
cat << 'AUDIT_CONTENT' > mobile_audit_report.md
# Mobile Experience Audit

## Thumb Reach & Navigation
The bottom navigation implementation in `app.component.html` seems reasonable for mobile reach:
`<nav class="fixed bottom-0 inset-x-0 z-50 lg:hidden bg-surface-200 border-t border-surface-100 pb-safe">`
However, back navigation heavily relies on browser history or Angular router rather than native-like back buttons or `Location.back()`.

## Keyboard Behavior
Viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />`
This uses `interactive-widget=resizes-content`, which is great for avoiding keyboard overlap issues on modern mobile browsers.

## Scrolling
`overscroll-behavior-y: none;` is set globally in `styles.scss:113` which is good for preventing bounce on the body, and `overscroll-contain` is used in some scrollable areas (e.g. `lightbox`, `correction-modal`).

## Safe Areas
The app uses environment variables for safe areas globally:
```css
padding-top: env(safe-area-inset-top);
padding-inline-start: env(safe-area-inset-left);
padding-inline-end: env(safe-area-inset-right);
```

## Modal Stacking & Z-index
There are several fixed elements with very high z-indexes (e.g., `z-[11000]`, `z-[10000]`, `z-[9999]`), which could lead to overlapping bugs. The `z-index` structure should be standardized or managed by a service like Angular CDK Overlay, which is not widely used based on the audit.

## Touch Targets
Most interactive elements use `min-h-[44px]` or `min-w-[44px]` (checked via `resource-library.component.ts` and `reading-engine.component.ts`). However, some elements might not be large enough. A deeper review is needed, but 44px is generally considered the minimum for Apple's HIG (48px for Material Design).

## Media Capture & Voice Recording
The app uses standard Web APIs `MediaRecorder` rather than native APIs via a wrapper like Capacitor or Ionic.
```typescript
private mediaRecorder: MediaRecorder | null = null;
```

## Long Presses
A `app-long-press-context-menu` component is used in `chat-message` and `chat-room`. It manages touch interactions. A `flashcard-context-menu.directive.ts` also handles long presses.

## Transitions
The app implements View Transitions API (`startViewTransition`) in `view-transition.service.ts`. This provides native-like page transitions.

AUDIT_CONTENT
cat mobile_audit_report.md
