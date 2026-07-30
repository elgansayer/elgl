# i18n Fixes for `components-chat-room` Module

## File: `frontend/src/app/components/chat-room/chat-room.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `chatRoom.liveStatus`
- `chatRoom.connectingStatus`
- `chatRoom.loadingMessages`
- `chatRoom.noMessages`
- `chatRoom.transliterateBtn`
- `chatRoom.someoneTyping`
- `chatRoom.originalSentence`
- `chatRoom.correctedSentence`
- `chatRoom.explanation`
- `chatRoom.sendCorrection`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `Admin`
- `Group Admin Settings`
- `Rename`
- `Add Member`
- `Remove Member`
Attributes:
- `placeholder="New Group Name"`
- `placeholder="User ID to Add"`
- `placeholder="User ID to Remove"`
- `alt="doodle"`
- `alt="sticker"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
