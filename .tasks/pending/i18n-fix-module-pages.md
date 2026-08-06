
* Priority: High Impact
* Description: Missing keys used in UI but not found in en.json for module 'pages':
  - `settings.linkedAccounts.unlink` in frontend/src/app/pages/settings/linked-accounts/linked-accounts.component.ts
  - `vip.subscribeNow` in frontend/src/app/pages/vip-subscription/vip-subscription.component.html
  - `vip.startFree` in frontend/src/app/pages/vip/vip.component.html
  - `admin.users.no` in frontend/src/app/pages/admin/admin-users.component.html
  - `aiPartner.inputPlaceholder` in frontend/src/app/pages/chat/chat-page.component.ts
  - `support.subtitle` in frontend/src/app/pages/support-centre/support-centre.component.ts
  - `communities.create` in frontend/src/app/pages/communities/communities.component.html
  - `vip.featureTableHeader` in frontend/src/app/pages/vip-subscription/vip-subscription.component.html
  - `chat_settings.title` in frontend/src/app/pages/chat-settings/chat-settings.component.html
  - `join.joining` in frontend/src/app/pages/join-group/join-group.component.html
  - ... and 176 more.
* Technical Implementation: Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `pages.component.element` structure.

* Priority: Medium Impact
* Description: Hardcoded English strings found in templates for module 'pages':
  - 'Popular' in frontend/src/app/pages/vip-subscription/vip-subscription.component.html
  - 'Help Centre' in frontend/src/app/pages/help-centre/help-centre.component.html
  - 'No articles found.' in frontend/src/app/pages/help-centre/help-centre.component.html
  - 'Previous' in frontend/src/app/pages/help-centre/help-centre.component.html
  - 'Next' in frontend/src/app/pages/help-centre/help-centre.component.html

* Technical Implementation: Replace hardcoded strings with translation keys (e.g. `{{ 'pages.keyName' | t }}`) and add the corresponding entries to `frontend/src/assets/i18n/en.json`.
