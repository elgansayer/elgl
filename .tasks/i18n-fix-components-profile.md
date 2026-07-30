# i18n Fixes for `components-profile` Module

## File: `frontend/src/app/components/profile/profile.component.html`

**Priority:** High Impact
**Description:** Missing translation keys found that are visible as raw keys.
- `profile.defaultName`
- `profile.joinedPrefix`
- `profile.visitorsHide`
- `profile.visitorsLink`
- `profile.visitorsTitle`
- `profile.anonymousVisitor`
- `profile.noVisitors`
- `profile.statNative`
- `profile.statTarget`
- `profile.statStreak`
- `profile.statCorrections`
- `profile.correctorScore`
- `profile.noRatings`
- `profile.proficiencyLabel`
- `profile.navFav`
- `profile.navVocab`
- `profile.navRooms`
- `profile.navDev`
- `admin.navLink`
- `profile.chipExchange`
- `profile.vipBannerTitle`
- `profile.vipBannerPrice`
- `privacy.lastSeen`
- `privacy.profilePhoto`
- `privacy.aboutInfo`
- `privacy.status`
- `profile.unblockUser`
- `profile.blockUser`
- `profile.reportUser`
- `profile.avatarLabel`
- `profile.changePhoto`
- `profile.nativeLangPlaceholder`
- `profile.targetLangPlaceholder`
- `profile.visibilityLabel`
- `profile.visibility.everyone`
- `profile.visibility.vipsOnly`
- `profile.visibility.hidden`
- `privacy.everyone`
- `privacy.contacts`
- `privacy.nobody`
- `profile.statusLabel`
- `profile.statusPlaceholder`
**Technical Implementation:** Add these keys to `frontend/src/assets/i18n/en.json` with proper structure.

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `🔥 {{ profile()?.study_streak_days }}d`
- `{{ profile()?.correction_ratio }}x`
- `A1`
- `A2`
- `B1`
- `B2`
- `C1`
- `C2`
Attributes:
- `alt="avatar"`
- `aria-label="Remove language"`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
