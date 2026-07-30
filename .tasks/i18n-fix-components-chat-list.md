# i18n Fixes for `components-chat-list` Module

## File: `frontend/src/app/components/chat-list/chat-list.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `chatList.lockedFolder`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Attributes:
- `aria-label="Open menu"`
- `placeholder="Search"`
- `aria-label="Filter options"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
