# i18n Fixes for `components-notifications-inbox` Module

## File: `frontend/src/app/components/notifications-inbox/notifications-inbox.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `notifications.title`
- `notifications.markAllRead`
- `notifications.emptyTitle`
- `notifications.emptySubtitle`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `&larr;`
Attributes:
- `aria-label="Go back"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
