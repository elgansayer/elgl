## 2026-08-03 - Dynamic ARIA Labels in Angular Loops

**Learning:** When assigning `aria-label` within Angular `@for` loops (like iterating over colors in `doodle-pad.component.html`), using a static label (e.g., `aria-label="Select color"`) causes screen readers to announce identical labels for all options, failing to provide distinguishable context to the user.

**Action:** Always use property binding `[attr.aria-label]` to generate dynamic and descriptive text (e.g., `[attr.aria-label]="'Select ' + color"`) for looped elements.
