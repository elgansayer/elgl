---
priority: High Impact
---
# i18n Fix for `admin` Module

## Description
This task covers resolving missing translation keys (High Impact) and externalizing hardcoded text (Medium Impact) for the `admin` module to guarantee a 100% translatable UI.

### Hardcoded Text (Needs to be translated)
- **frontend/src/app/admin/user-management/user-management.component.html**
  - "User Management"
  - "Loading users..."

## Technical Implementation
1. Add missing keys and externalize hardcoded text into `frontend/src/assets/i18n/en.json` following a logical standard (e.g. `admin.propertyName`).
2. Replace hardcoded text in HTML templates with `{{ 'key' | t }}` or `[attr.aria-label]="'key' | t"`.
3. Use translation interpolation for dynamic values.
4. Verify that no raw keys or hardcoded text are visible in the `admin` components.
