# Mobile Audit Report

This report audits the application for mobile social application UX standards, assuming it's an actual mobile application rather than just a responsive website.

## 1. Viewport & Safe Areas
- **Viewport Meta Tag:** The `<meta name="viewport">` tag in `frontend/src/index.html` is `width=device-width, initial-scale=1`. For a true mobile app experience, this must be `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`. This prevents double-tap zooming, pinch zooming, and allows the UI to draw under the notch (safe area) on iOS.
- **Safe Area Insets:** The bottom navigation bar in `frontend/src/app/app.component.html` uses a `pb-safe` utility class, but Tailwind CSS doesn't natively include this utility, and we do not see it defined in `frontend/tailwind.config.js` or `frontend/src/styles.scss`. We need to define `pb-safe`, `pt-safe`, `pl-safe`, and `pr-safe` utilities using `env(safe-area-inset-*)`.
- **Dynamic Viewport Height:** Global `html, body` styles in `frontend/src/styles.scss` and `index.html` use `h-full`. They should use `h-[100dvh]` to account for dynamic browser chrome collapsing, avoiding content getting hidden behind the browser's address bar when scrolling.

## 2. Touch Targets & Thumb Reach
- **Touch Targets:** The application lacks global enforcement of minimum touch target sizes (e.g., 44x44 points for iOS, 48x48 points for Android). Many interactive elements (like icon buttons or chips) rely only on internal padding, which might result in touch targets that are too small and frustrating for users.
- **Thumb Reach:** Critical actions and primary navigation should ideally be placed in the bottom half of the screen.

## 3. Scrolling Behavior
- **Overscroll Behavior:** The application doesn't prevent elastic scrolling (the bounce effect when pulling past the top or bottom of a page). A native app usually doesn't have this unless it's a specific "pull to refresh" area. We need `overscroll-behavior-y: none;` on the `body` tag in `styles.scss` or `index.html`.
- **Momentum Scrolling:** `-webkit-overflow-scrolling: touch;` should be ensured on scrollable containers for smooth momentum scrolling on older iOS devices.

## 4. Native Interactions & Context Menus
- **Text Selection:** Text selection is enabled globally. In a mobile app, text should not be selectable unless it's within an explicit input field (`input`, `textarea`) or specific message text. We should add `user-select: none;` (`-webkit-user-select: none;`) to the `body` and re-enable it only for inputs (`user-select: auto;`).
- **Callout Menus:** Long-pressing elements on iOS triggers a default context menu (callout). We need `-webkit-touch-callout: none;` globally.
- **Tap Highlight:** Tapping links and buttons in mobile browsers often shows a grey/blue highlight. Native apps don't have this. We should add `-webkit-tap-highlight-color: transparent;` globally.

## 5. Keyboard Behavior & Overlays
- **Virtual Keyboard Avoidance:** When focusing on inputs, the virtual keyboard can cover the input. Using `interactive-widget=resizes-content` in the viewport meta tag can help modern browsers resize the viewport correctly. Modals and overlays also need to be aware of keyboard presence to avoid pushing content out of view.
- **Modal Stacking:** Ensure modals (like the report user modal, confirm dialog, etc.) handle stacking contexts correctly and block interaction with the underlying UI.

## 6. Media Capture & Voice Recording
- We didn't do a full audit of media capture APIs in the code, but any web-based media capture needs to properly handle `Permissions API` and give clear UI feedback (loading spinners, error states) because native apps have highly responsive native pickers. WebRTC (if used for live rooms) will have browser-level prompts that feel less integrated than native OS prompts.

## 7. Back-Navigation
- Using the browser back button or Android physical back button might not map 1:1 to closing modals or navigating back in the app hierarchy if the Angular router doesn't push states for modals. This can trap users. Modals should ideally push a state to history or be interceptable by the back button.

## Actionable Recommendations
1. Update `index.html` viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />`.
2. Add safe area utility classes (e.g., using a Tailwind plugin or directly in CSS) and apply them to the top nav (pt-safe) and bottom nav (pb-safe).
3. Update `styles.scss`:
   - Change `h-full` on html/body to `h-[100dvh]`.
   - Add `overscroll-behavior-y: none;` on body.
   - Add `-webkit-tap-highlight-color: transparent;` globally.
   - Add `user-select: none;` and `-webkit-touch-callout: none;` globally, then explicitly allow `user-select: text;` on inputs and select text areas.
4. Define and enforce minimum touch target sizes for all interactive primitives in the design system.
