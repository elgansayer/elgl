Priority: Medium Impact

Description:
To improve mobile responsiveness and ensure the app is easy to use on touch devices, we need to audit and adjust touch targets. Currently, some buttons in the chat interface (like inline "Correct" and "Ask for correction" buttons) rely on small text links. Discovery controls might also be too small.

Technical Implementation:
1.  **Global Touch Target Standard:** Implement a minimum touch target size of 44x44px (Apple HIG standard) or 48x48px (Material Design standard) for all interactive elements.
2.  **SCSS Utility:** Create a Tailwind plugin or utility class (e.g., `touch-target`) that applies a pseudo-element (`::after`) to artificially expand the clickable area of small icons/text links without changing their visual layout.
    ```css
    .touch-target {
      position: relative;
      &::after {
        content: '';
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: 44px; height: 44px;
      }
    }
    ```
3.  **Chat Page Specifics:** Apply this new utility to the "Correct", "Fix", and "Reply to Status" buttons in `ChatPageComponent`. Convert them from text links into recognizable icon buttons (e.g., a pencil or wand icon) for better visual weight on mobile.
4.  **Discovery Page Specifics:** Ensure the audio play/pause button in `AudioIntroFeedComponent` is at least 48x48px (currently it uses `w-10 h-10` which is 40px). Update to `w-12 h-12`.