Priority: High Impact

Description:
To ensure the application is usable by all users, including those using screen readers or navigating via keyboard, we must conduct an accessibility audit. Current implementations lack comprehensive ARIA attributes and focus management.

Technical Implementation:
1.  **ARIA Labels & Roles:**
    *   Audit all icon buttons (e.g., play/pause in discovery, export in chat) and ensure they have descriptive `aria-label` attributes using the translation pipe (`[attr.aria-label]="'key' | t"`).
    *   Ensure custom interactive elements (like the room list items in `ChatPageComponent`) have proper roles (e.g., `role="button"` or `role="listitem"`) and `aria-selected` states.
2.  **Keyboard Navigation:**
    *   Ensure all custom buttons and list items are focusable (`tabindex="0"`).
    *   Add `(keydown.enter)` and `(keydown.space)` handlers to elements that have `(click)` handlers but aren't native `<button>` or `<a>` elements (e.g., the room select in chat).
    *   Implement focus trapping for modal/overlay elements (e.g., the correction popover proposed in another task) using `@angular/cdk/a11y` (`cdkTrapFocus`).
3.  **Colour Contrast:**
    *   Review the dark mode palette (`#121212` backgrounds with neon accents). Ensure the text-muted colors (e.g., `text-text-muted`) meet at least WCAG AA contrast ratio against `bg-surface-200` or `bg-surface-300` layers.
    *   Adjust Tailwind configuration if necessary to slightly brighten muted text or darken background surfaces for better readability.