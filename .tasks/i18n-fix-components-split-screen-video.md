# i18n Fixes for `components-split-screen-video` Module

## File: `frontend/src/app/components/split-screen-video/split-screen-video.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `{{ hostName() }} (Host)`
- `{{ coHostName() }} (Co-Host)`
- `Invite Co-Host`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
