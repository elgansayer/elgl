# i18n Fixes for `components-primitives` Module

## File: `frontend/src/app/components/primitives/language-picker/language-picker.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `lang.selectPlaceholder`
- `lang.selectLanguage`
- `lang.searchPlaceholder`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Attributes:
- `aria-label="Close dialog"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.

## File: `frontend/src/app/components/primitives/toast/toast.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `toast works!`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
