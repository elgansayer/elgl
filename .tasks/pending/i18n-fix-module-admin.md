
* Priority: Medium Impact
* Description: Hardcoded English strings found in templates for module 'admin':
  - 'User Management' in frontend/src/app/admin/user-management/user-management.component.html
  - 'Loading users...' in frontend/src/app/admin/user-management/user-management.component.html
  - 'User' in frontend/src/app/admin/user-management/user-management.component.html
  - 'Native Lang' in frontend/src/app/admin/user-management/user-management.component.html
  - 'Coins' in frontend/src/app/admin/user-management/user-management.component.html
  - 'Streak' in frontend/src/app/admin/user-management/user-management.component.html
  - 'VIP Status' in frontend/src/app/admin/user-management/user-management.component.html
  - 'Actions' in frontend/src/app/admin/user-management/user-management.component.html
  - 'Toggle VIP' in frontend/src/app/admin/user-management/user-management.component.html

* Technical Implementation: Replace hardcoded strings with translation keys (e.g. `{{ 'admin.keyName' | t }}`) and add the corresponding entries to `frontend/src/assets/i18n/en.json`.
