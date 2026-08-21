# Mobile UX Audit Report

## Issue Overview
This audit examines the frontend codebase as an actual mobile social application. We evaluated thumb reach, keyboard behaviour, scrolling, overlays, safe areas, back-navigation, modal stacking, touch targets, media capture, long presses, voice recording, and transitions.

## Key Findings

1. **Safe Area Management**: The app uses `pb-safe` on the main mobile navigation bar (`app.component.html`), which is good. However, many floating action buttons (FABs), bottom sheets, and sticky footers across various features (like chat rooms, profile edit, video calls, etc.) hardcode bottom spacing (e.g., `bottom-0`, `bottom-2`, `bottom-4`) without accounting for safe area insets on modern bezel-less devices (like iPhones with home indicators).
    *   `tailwindcss-safe-area` is installed in `package.json` but not enabled in `tailwind.config.js`. This is a critical gap preventing the use of utilities like `pb-safe` or `bottom-safe-offset-4`.
    *   The `viewport-fit=cover` property is missing from the `<meta name="viewport">` tag in `index.html`. This prevents the browser from actually expanding content into the safe areas.

2. **Scrolling and Overlays**: Several screens use `fixed` or `absolute` positioning for content that might overlap with the keyboard or bottom navigation. The `pb-[72px]` on the main content wrapper in `app.component.html` attempts to clear the bottom nav, but a more robust CSS Grid or flexbox layout with proper safe-area integration would prevent layout shifts.

3. **Touch Targets**: Button padding (e.g., `pt-1.5 pb-1.5`, `pt-2 pb-2`) varies across components. While some use `app-padded`, many inline buttons (especially in `chat-room.component.html` and `chat-list.component.html`) might fall below the recommended 44x44pt minimum touch target size.

4. **Transitions and Modals**: Modals (like `trust-safety-modal`, `report-user-modal`) are used extensively, but ensuring they stack correctly without trapping focus or creating double-scrollbars needs continuous monitoring. The use of Tailwind animations (`animate-in`, `fade-in`) is consistent, but interruptibility during fast interactions wasn't fully verifiable via static analysis.

## Recommendations

1. **Enable `tailwindcss-safe-area`**:
   - Add `require('tailwindcss-safe-area')` to the `plugins` array in `frontend/tailwind.config.js`.
2. **Update Viewport Meta Tag**:
   - Change `<meta name="viewport" content="width=device-width, initial-scale=1" />` to `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />` in `frontend/src/index.html`.
3. **Refactor Bottom-Aligned Elements**:
   - Replace static bottom utilities (like `bottom-4`) with safe-area aware utilities (like `bottom-safe-offset-4` or adding `pb-safe`) on FABs, fixed footers, and bottom sheets throughout the app.
4. **Standardize Touch Targets**:
   - Enforce minimum dimensions (`min-h-[44px] min-w-[44px]`) on interactive elements to improve thumb reach and usability.

*Note: As per architecture guidelines, this is a read-only audit. No codebase modifications have been made during this task.*
