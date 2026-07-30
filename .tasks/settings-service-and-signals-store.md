---
Priority: High Impact
Description: Establish the central `SettingsService` utilizing an RxJS BehaviorSubject (or the new Signals service) to hold the canonical `UserSettings` object. This service must manage the read/write lifecycle, handling both API calls and triggering optimistic UI updates locally upon user interaction.
Technical Implementation: Implement the service utilizing a pattern of `private settingsSubject` which exposes a `public readonly settings$: Signal<UserSettings>` observable for consumption by all child components.
---

