---
priority: High Impact
---
# i18n Fix for `events` Module

## Description
This task covers resolving missing translation keys (High Impact) and externalizing hardcoded text (Medium Impact) for the `events` module to guarantee a 100% translatable UI.

### Missing Keys (Raw keys leaking to user)
- **frontend/src/app/events/create-event-modal/create-event-modal.component.ts**
  - `events.createEvent`
  - `events.title`
  - `events.titlePlaceholder`
  - `events.dateTime`
  - `events.where`
  - `events.whereHint`
  - `events.wherePlaceholder`
  - `events.description`
  - `events.descriptionPlaceholder`
  - `events.cancel`
  - `events.create`

## Technical Implementation
1. Add missing keys and externalize hardcoded text into `frontend/src/assets/i18n/en.json` following a logical standard (e.g. `events.propertyName`).
2. Replace hardcoded text in HTML templates with `{{ 'key' | t }}` or `[attr.aria-label]="'key' | t"`.
3. Use translation interpolation for dynamic values.
4. Verify that no raw keys or hardcoded text are visible in the `events` components.
