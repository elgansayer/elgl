# i18n Fixes for `components-update-modal` Module

## File: `frontend/src/app/components/update-modal/update-modal.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Update Required`
- `OK`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
