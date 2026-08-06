
* Priority: High Impact
* Description: Missing keys used in UI but not found in en.json for module 'app.component.html':
  - `app_lock.unlock_btn` in frontend/src/app/app.component.html
  - `app_lock.subtitle` in frontend/src/app/app.component.html
  - `app_lock.title` in frontend/src/app/app.component.html
  - `app_lock.enable_biometric` in frontend/src/app/app.component.html
  - `app_lock.disable_biometric` in frontend/src/app/app.component.html
  - `nav.guided_tour` in frontend/src/app/app.component.html

* Technical Implementation: Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `app.component.html.component.element` structure.
