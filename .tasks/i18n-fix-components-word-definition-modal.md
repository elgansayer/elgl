# i18n Fixes for `components-word-definition-modal` Module

## File: `frontend/src/app/components/word-definition-modal/word-definition-modal.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `LingQ Interactive Reader`
- `Translation`
- `Dictionary definition`
- `Context:`
- `Spaced repetition status:           {{ existingCard() ? 'Level ' + existingCard()!.srs_level : 'New (Blue)' }}`
- `🟡 Save to learning`
- `⚪ Mark known`
- `Reset to new (Level 0 / Blue)`
Attributes:
- `title="Listen to pronunciation"`
- `aria-label="Close"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
