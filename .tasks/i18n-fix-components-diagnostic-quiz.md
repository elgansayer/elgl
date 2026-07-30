# i18n Fixes for `components-diagnostic-quiz` Module

## File: `frontend/src/app/components/diagnostic-quiz/diagnostic-quiz.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Language Level Diagnostic`
- `Question {{ currentIndex() + 1 }} of {{ questions().length }}`
- `Previous`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
