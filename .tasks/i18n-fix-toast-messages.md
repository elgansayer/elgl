Priority: Medium Impact

Description:
A significant number of toast notifications displayed to users rely on hardcoded strings within TypeScript store and component files, resulting in non-translatable feedback messages. An audit revealed around 29 such instances.

Notable affected files and specific strings:
- `frontend/src/app/services/toast.service.ts`: Hardcoded fallback "Not implemented yet".
- `frontend/src/app/services/economy.store.ts`: "Failed to start VIP checkout. Please try again.", "Failed to submit report.", "Failed to block user.", "Failed to send virtual gift. Ensure you have sufficient coin balance.", "Failed to generate API key. Requires Developer Tier subscription...".
- `frontend/src/app/components/word-definition-modal/word-definition-modal.component.ts`: "Error updating SRS review schedule."
- `frontend/src/app/components/chat-room/chat-room.component.ts`: "Group renamed successfully", "Failed to rename group", "Member added successfully", "Failed to add member", "Member removed successfully", "Failed to remove member".
- `frontend/src/app/components/voice-recorder/voice-recorder.component.ts`: "Microphone permission required to record voice notes."

Technical Implementation:
1. Inject the `I18nService` if not already present in the affected classes/functions.
2. Replace hardcoded strings with service calls: `showToast(this.i18n.translate('feature.actionSuccess'))`. For standalone functions like in `toast.service.ts` or where injection is complex, ensure an alternative dependency injection method or refactoring is applied so translations can be fetched.
3. Add the newly created translation keys (e.g. `economy.vipCheckoutError`, `chatRoom.groupRenamedSuccess`, etc.) to the `frontend/src/assets/i18n/en.json` file.
