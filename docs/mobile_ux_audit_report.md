# Mobile UX Audit Report

This audit assesses the product simulating an actual mobile application rather than a responsive website, focusing on core mobile UX paradigms.

## 1. Safe Areas
* **Viewport Metatag:** The application currently lacks `viewport-fit=cover` in `index.html`. This means the web view will not extend into the safe areas of modern notch/island-equipped devices, leaving awkward uncoloured letterboxing at the top/bottom.
* **CSS Environment Variables:** The application does not use `env(safe-area-inset-top)` or `env(safe-area-inset-bottom)` anywhere in the CSS to adjust padding dynamically.
* **Bottom Navigation:** The bottom navigation bar in `app.component.html` has a `pb-safe` class, but there is no corresponding definition in Tailwind or global styles, meaning the class does nothing.

## 2. Thumb Reach
* The application places important non-dismissible alerts (e.g. `no-network-banner.component.ts`, `toast.component.ts`) statically at `fixed top-0` or `top-10`. These are hard to reach and dismiss on tall mobile displays.
* Some floating action buttons (e.g. `groups-discovery.component.ts`) are correctly placed at the bottom-end, but overlay the safe area without accounting for it.

## 3. Touch Targets
* **Buttons:** Standard Helm buttons (`hlm-button.ts`) use standard Tailwind heights (`h-8`, `h-9`). While the `touch` variant has `min-h-11`, many interactive elements (like icon buttons or anchors in `app.component.html`) lack explicit 44px min-width/height dimensions for reliable tapping.
* **Links:** Bottom tab items use custom padding but aren't strictly guaranteed a `44x44` hit area in CSS.

## 4. Modal Stacking & Overlays
* **Backdrop Blurs:** The application uses heavy `bg-black/80 backdrop-blur-sm` inline for multiple custom modals (e.g., `approve-speaker-modal`, `moments-feed`, `private-party-create-modal`). This indicates inconsistent modal implementations bypassing standard UI dialog containers, leading to potential stacking context conflicts if multiple overlays trigger at once.
* **Overflow Handling:** Several modals lack height constraints with inner scrolling, risking modal content extending beyond the viewport and becoming unreachable.

## 5. Back-Navigation
* **Popstate Listeners:** There are no `HostListener('window:popstate')` decorators on modal or drawer components. When users press the physical Android back button (or use iOS swipe-back), it will bypass the open modal and navigate the underlying router backwards, leaving a detached modal floating over the wrong route.

## 6. Scrolling
* **Overscroll Behavior:** There is no global `overscroll-y-none` on the `body` to prevent the elastic pull-to-refresh glow effect when scrolling past bounds on mobile browsers.
* Specific scrolling regions (like the `report-user-modal`) do have `overscroll-contain`, which is a good practice, but not universally applied.

## 7. Keyboard Behaviour
* **Input Modes:** Number inputs (e.g., `lesson-manager.component.html` difficulty level) lack the `inputmode="numeric"` attribute, forcing the user to switch the standard text keyboard to numbers manually.
* **Enter Key Hints:** Search boxes and chat inputs do not leverage `enterkeyhint="search"` or `enterkeyhint="send"`, so the mobile keyboard shows a generic "Go" or "Enter" rather than the contextual action.

## 8. Media Capture & Voice Recording
* **File Uploads:** Existing `<input type="file">` components (like `avatar-upload.component.html`) do not include the `capture` attribute (e.g. `capture="environment"` or `capture="user"`), forcing users through a generic file picker dialog rather than jumping directly to the mobile camera interface when updating a profile photo.

## 9. Long Presses
* The application implements a `app-long-press-context-menu`, but standard touch events `(touchstart)`, `(touchend)` often conflict with native browser magnifying glass or text selection.
* `(contextmenu)` prevention is inconsistently applied across elements triggering long-press behaviour.

## 10. Transitions
* The `<router-outlet>` in the main layout lacks entry/exit view animations. Navigating between top-level tabs instantly cuts between views, lacking the spatial mapping (e.g. lateral sliding or depth scaling) expected of native app transitions.
