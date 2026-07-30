# i18n Fixes for `components-profile-edit` Module

## File: `frontend/src/app/components/profile-edit/profile-edit.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Free users: max 1 language. VIP: up to 3 languages.`
- `Bio`
- `Privacy Settings`
- `Hide Age`
- `Hide Location`
- `Hide from Search`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
