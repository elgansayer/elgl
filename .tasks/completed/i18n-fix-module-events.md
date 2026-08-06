
* Priority: High Impact
* Description: Missing keys used in UI but not found in en.json for module 'events':
  - `events.dateTime` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.titlePlaceholder` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.cancel` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.where` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.wherePlaceholder` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.createEvent` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.whereHint` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.description` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.title` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - `events.create` in frontend/src/app/events/create-event-modal/create-event-modal.component.ts
  - ... and 1 more.
* Technical Implementation: Add the missing keys to `frontend/src/assets/i18n/en.json` ensuring they match the `events.component.element` structure.
