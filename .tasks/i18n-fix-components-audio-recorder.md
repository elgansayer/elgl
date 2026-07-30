# i18n Fixes for `components-audio-recorder` Module

## File: `frontend/src/app/components/audio-recorder/audio-recorder.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `audio_recorder.current_intro`
- `audio_recorder.stop`
- `audio_recorder.upload`
- `audio_recorder.discard`
- `audio_recorder.record`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `{{ duration }} s / 30 s`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
