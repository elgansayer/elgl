---
priority: High Impact
---
# i18n Fix for `services` Module

## Description
This task covers resolving missing translation keys (High Impact) and externalizing hardcoded text (Medium Impact) for the `services` module to guarantee a 100% translatable UI.

### Missing Keys (Raw keys leaking to user)
- **frontend/src/app/services/audio-rooms.store.ts**
  - `audioRoom.joinError`
  - `audioRoom.speakerApprovedToast`
  - `audioRoom.speakerDemotedToast`
  - `audioRoom.coHostPromotedToast`
  - `audioRoom.coHostRemovedToast`
  - `audioRoom.roomEndedToast`
  - `audioRoom.raiseHandToast`
  - `audioRoom.inviteCoHostError`
  - `audioRoom.removeCoHostError`
- **frontend/src/app/services/i18n.service.spec.ts**
  - `vip.heroTitle`
  - `vip.heroSubtitle`
  - `vip.seePlans`
  - `vip.startFree`
  - `vip.freePrice`
  - `vip.consumerPrice`
  - `vip.developerPrice`
  - `vip.billedMonthly`
  - `vip.consumerFeature1`
  - `vip.consumerFeature2`
  - `vip.developerFeature3`
  - `vip.developerFeature4`
  - `vip.faqTitle`
  - `vip.faqSwitchQ`
  - `vip.faqPaymentA`
  - `vip.faqCancelQ`
  - `vip.choosePlan`

## Technical Implementation
1. Add missing keys and externalize hardcoded text into `frontend/src/assets/i18n/en.json` following a logical standard (e.g. `services.propertyName`).
2. Replace hardcoded text in HTML templates with `{{ 'key' | t }}` or `[attr.aria-label]="'key' | t"`.
3. Use translation interpolation for dynamic values.
4. Verify that no raw keys or hardcoded text are visible in the `services` components.
