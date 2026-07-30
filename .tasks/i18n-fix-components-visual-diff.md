# i18n Fixes for `components-visual-diff` Module

## File: `frontend/src/app/components/visual-diff/visual-diff.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `✏️ Language Correction Diff`
- `Intl.Segmenter word engine`
- `💡 Tutor explanation:`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
