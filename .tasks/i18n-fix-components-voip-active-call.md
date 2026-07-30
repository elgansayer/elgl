# i18n Fixes for `components-voip-active-call` Module

## File: `frontend/src/app/components/voip-active-call/voip-active-call.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `call.mute`
- `call.unmute`
- `call.speaker`
- `call.hang_up`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `call_end`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
