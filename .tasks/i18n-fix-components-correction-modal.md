# i18n Fixes for `components-correction-modal` Module

## File: `frontend/src/app/components/correction-modal/correction-modal.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `moments.correctSentenceTitle`
- `moments.ghostOriginal`
- `moments.resetGhost`
- `moments.liveDiffPreview`
- `common.optional`
- `common.cancel`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Ghost Text`
Attributes:
- `placeholder="Edit sentence to correct grammar, spelling, or natural phrasing..."`
- `placeholder="Explain grammar rule, nuance, or native alternative..."`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
