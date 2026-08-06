
* Priority: High Impact
* Description: Missing keys used in UI but not found in en.json for module 'components':
  - `forgot_password.new_password_label` in frontend/src/app/components/forgot-password/forgot-password.component.ts
  - `profile.catalogNamePlaceholder` in frontend/src/app/components/profile/profile.component.html
  - `suggest_flashcards.loading` in frontend/src/app/components/suggest-flashcards/suggest-flashcards.component.ts
  - `onboarding.step3.label` in frontend/src/app/components/onboarding/onboarding-wizard.component.ts
  - `profile.statCorrections` in frontend/src/app/components/profile/profile.component.html
  - `profile.visibility.everyone` in frontend/src/app/components/profile/profile.component.html
  - `events.locationInPerson` in frontend/src/app/components/create-event-modal/create-event-modal.component.html
  - `settings.hideOnlineStatus` in frontend/src/app/components/settings/settings.component.html
  - `settings.clearCache` in frontend/src/app/components/settings/settings.component.html
  - `report.block_user` in frontend/src/app/components/report-user-modal/report-user-modal.component.html
  - ... and 609 more.
* Technical Implementation: Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `components.component.element` structure.

* Priority: Medium Impact
* Description: Hardcoded English strings found in templates for module 'components':
  - 'LingQ Interactive Reader' in frontend/src/app/components/word-definition-modal/word-definition-modal.component.html
  - 'Translation' in frontend/src/app/components/word-definition-modal/word-definition-modal.component.html
  - 'Dictionary definition' in frontend/src/app/components/word-definition-modal/word-definition-modal.component.html
  - 'Update Required' in frontend/src/app/components/update-modal/update-modal.component.html
  - 'USD' in frontend/src/app/components/profile/profile.component.html
  - 'EUR' in frontend/src/app/components/profile/profile.component.html
  - 'GBP' in frontend/src/app/components/profile/profile.component.html
  - 'JPY' in frontend/src/app/components/profile/profile.component.html
  - 'AUD' in frontend/src/app/components/profile/profile.component.html
  - 'CAD' in frontend/src/app/components/profile/profile.component.html
  - ... and 26 more.
* Technical Implementation: Replace hardcoded strings with translation keys (e.g. `{{ 'components.keyName' | t }}`) and add the corresponding entries to `frontend/src/assets/i18n/en.json`.
