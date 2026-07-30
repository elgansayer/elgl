# i18n Fixes for `components-audio-sync-reader` Module

## File: `frontend/src/app/components/audio-sync-reader/audio-sync-reader.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Audio-Synchronised LingQ Immersion (`timeupdate` word boundary tracking). Click any token to         inspect dictionary definitions or save to your flashcards deck.`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
