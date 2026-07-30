# i18n Fixes for `components-doodle-pad` Module

## File: `frontend/src/app/components/doodle-pad/doodle-pad.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `🎨 Interactive Doodle Pad`
- `{{ w }}px`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
