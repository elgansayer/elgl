## 2026-08-03 - Dynamic ARIA Labels in Angular Loops

**Learning:** When assigning `aria-label` within Angular `@for` loops (like iterating over colours in `doodle-pad.component.html`), using a static label (e.g., `aria-label="Select colour"`) causes screen readers to announce identical labels for all options, failing to provide distinguishable context to the user.

**Action:** Always use property binding `[attr.aria-label]` to generate dynamic and descriptive text (e.g., `[attr.aria-label]="'Select ' + colour"`) for looped elements.

## 2026-07-30 - Adding aria-labels to icon buttons
**Learning:** It's important to only add aria-labels to buttons that are truly icon-only. If a button already has translated text content (e.g. `{{ 'common.close' | t }}`), adding a hardcoded aria-label overrides the localized text with English for screen reader users, breaking accessibility for non-English users.
**Action:** Verify if a button contains actual text or text via translation pipe before adding an aria-label. Use `[attr.aria-label]="'key' | t"` if the label needs to be localized.

## 2024-08-02 - Icon-Only Button Accessibility in Core Navigation
**Learning:** Primary navigation and header action bars often contain icon-only buttons (like Compose, Notifications, or Profile) that rely entirely on visual metaphors. Without proper `aria-label`s, screen readers cannot identify these core application actions, causing a significant accessibility barrier on high-traffic pages like the moments feed.
**Action:** Always ensure icon-only interactive elements (both `<button>` and `<a>` tags) have descriptive `[attr.aria-label]` properties using the translation pipe to support internationalization and screen readers.
