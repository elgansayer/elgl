---
priority: High Impact
---
# i18n Fix for `app.component.html` Module

## Description
This task covers resolving missing translation keys (High Impact) and externalizing hardcoded text (Medium Impact) for the `app.component.html` module to guarantee a 100% translatable UI.

### Missing Keys (Raw keys leaking to user)
- **frontend/src/app/app.component.html**
  - `app_lock.title`
  - `app_lock.subtitle`
  - `app_lock.unlock_btn`
  - `nav.guided_tour`
  - `app_lock.disable_biometric`
  - `app_lock.enable_biometric`
  - `tour.chat.title`
  - `tour.chat.text`
  - `tour.moments.title`
  - `tour.moments.text`
  - `tour.discovery.title`
  - `tour.discovery.text`
  - `tour.audio_rooms.title`
  - `tour.audio_rooms.text`
  - `tour.profile.title`
  - `tour.profile.text`

## Technical Implementation
1. Add missing keys and externalize hardcoded text into `frontend/src/assets/i18n/en.json` following a logical standard (e.g. `app.component.html.propertyName`).
2. Replace hardcoded text in HTML templates with `{{ 'key' | t }}` or `[attr.aria-label]="'key' | t"`.
3. Use translation interpolation for dynamic values.
4. Verify that no raw keys or hardcoded text are visible in the `app.component.html` components.
