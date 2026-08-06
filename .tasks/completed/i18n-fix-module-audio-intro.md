
* Priority: High Impact
* Description: Missing keys used in UI but not found in en.json for module 'audio-intro':
  - `audioIntro.title` in frontend/src/app/audio-intro/audio-intro-recorder.component.html
  - `audioIntro.stop` in frontend/src/app/audio-intro/audio-intro-recorder.component.html
  - `audioIntro.pause` in frontend/src/app/audio-intro/audio-intro-recorder.component.html
  - `audioIntro.recording` in frontend/src/app/audio-intro/audio-intro-recorder.component.html
  - `audioIntro.record` in frontend/src/app/audio-intro/audio-intro-recorder.component.html
  - `audioIntro.play` in frontend/src/app/audio-intro/audio-intro-recorder.component.html
  - `audioIntro.noRecording` in frontend/src/app/audio-intro/audio-intro-recorder.component.html

* Technical Implementation: Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `audio-intro.component.element` structure.
