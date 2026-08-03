---
priority: High Impact
---
# i18n Fix for `discovery` Module

## Description
This task covers resolving missing translation keys (High Impact) and externalizing hardcoded text (Medium Impact) for the `discovery` module to guarantee a 100% translatable UI.

### Missing Keys (Raw keys leaking to user)
- **frontend/src/app/discovery/audio-intro-feed/audio-intro-feed.component.ts**
  - `NO_AUDIO_INTROS`

## Technical Implementation
1. Add missing keys and externalize hardcoded text into `frontend/src/assets/i18n/en.json` following a logical standard (e.g. `discovery.propertyName`).
2. Replace hardcoded text in HTML templates with `{{ 'key' | t }}` or `[attr.aria-label]="'key' | t"`.
3. Use translation interpolation for dynamic values.
4. Verify that no raw keys or hardcoded text are visible in the `discovery` components.
