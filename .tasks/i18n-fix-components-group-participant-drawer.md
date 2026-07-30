# i18n Fixes for `components-group-participant-drawer` Module

## File: `frontend/src/app/components/group-participant-drawer/group-participant-drawer.component.ts`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `group.participants`
- `group.noParticipants`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

## File: `frontend/src/app/components/group-participant-drawer/group-participant-drawer.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Participants ({{ participants().length }})`
- `VIP`
- `Native:`
- `Learning:`
- `No participants found.`
Attributes:
- `alt="Avatar"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
