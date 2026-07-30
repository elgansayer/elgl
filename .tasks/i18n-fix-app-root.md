# i18n Fixes for `app-root` Module

## File: `frontend/src/app/app.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `app_lock.title`
- `app_lock.subtitle`
- `app_lock.unlock_btn`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Attributes:
- `alt="Gift Animation"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
