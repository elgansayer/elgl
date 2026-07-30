# i18n Fixes for `components-settings` Module

## File: `frontend/src/app/components/settings/settings.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `settings.hideOnlineStatus`
- `settings.hideVipStatus`
- `settings.chatSection`
- `settings.autoPlayVoiceNotes`
- `settings.enterToSend`
- `settings.textSize`
- `settings.textSizeSmall`
- `settings.textSizeMedium`
- `settings.textSizeLarge`
- `settings.dataAndStorageSection`
- `settings.autoDownloadMedia`
- `settings.clearCache`
- `common.clear`
- `settings.deleteOldMedia`
- `common.delete`
- `settings.soundVibrationSection`
- `settings.soundEffects`
- `settings.vibration`
- `settings.interestsSection`
- `settings.noInterests`
- `settings.addInterestPlaceholder`
- `common.add`
- `settings.linkedAccountsSection`
- `settings.linked`
- `settings.unlinkBtn`
- `settings.linkBtn`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `&times;`
Attributes:
- `aria-label="Go back"`
- `aria-label="Select color"`
- `aria-label="Remove interest"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
