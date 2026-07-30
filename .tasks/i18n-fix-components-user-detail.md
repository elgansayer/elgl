# i18n Fixes for `components-user-detail` Module

## File: `frontend/src/app/components/user-detail/user-detail.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `profile.nativeLang`
- `profile.targetLang`
- `profile.about`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `ID: {{ profile()?.id }}`
Attributes:
- `alt="avatar"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
