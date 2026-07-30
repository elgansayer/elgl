# i18n Fixes for `components-language-selector` Module

## File: `frontend/src/app/components/language-selector/language-selector.component.ts`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `nativeLanguage`
- `lang.selectLanguage`
- `targetLanguages`
- `addLanguage`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

## File: `frontend/src/app/components/language-selector/language-selector.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Attributes:
- `aria-label="Select App Language"`
- `aria-label="Close dialog"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
