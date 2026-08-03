---
priority: High Impact
---
# i18n Fix for `achievements` Module

## Description
This task covers resolving missing translation keys (High Impact) and externalizing hardcoded text (Medium Impact) for the `achievements` module to guarantee a 100% translatable UI.

### Missing Keys (Raw keys leaking to user)
- **frontend/src/app/achievements/achievements.component.ts**
  - `achievements.title`
  - `achievements.loading`
  - `achievements.loadError`
  - `achievements.empty`
  - `achievements.progressLabel`

## Technical Implementation
1. Add missing keys and externalize hardcoded text into `frontend/src/assets/i18n/en.json` following a logical standard (e.g. `achievements.propertyName`).
2. Replace hardcoded text in HTML templates with `{{ 'key' | t }}` or `[attr.aria-label]="'key' | t"`.
3. Use translation interpolation for dynamic values.
4. Verify that no raw keys or hardcoded text are visible in the `achievements` components.
