# i18n Fixes for `admin-user-management` Module

## File: `frontend/src/app/admin/user-management/user-management.component.html`

**Priority:** Medium/Low Impact
**Description:** Hardcoded text or attributes found.
Text nodes:
- `User Management`
- `Loading users...`
- `User`
- `Native Lang`
- `Coins`
- `Streak`
- `VIP Status`
- `Actions`
- `{{ user.study_streak_days }} days`
- `Toggle VIP`
**Technical Implementation:** Replace with appropriate `| t` pipe or bound attributes (e.g. `[placeholder]="'key' | t"`) and add to `en.json`.
