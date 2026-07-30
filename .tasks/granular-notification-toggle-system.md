---
Priority: Medium Impact
Description: Build the `NotificationSettingsComponent` with a simple, yet powerful toggle array. Each toggle must trigger an immediate, optimistic UI update and queue an API command to the backend without requiring full form submission.
Technical Implementation: Use individual `FormControl` components within a `FormGroup` that, on change detection, fire a small, dedicated `NotificationService.updateToggle(key, value)` call that updates the local state immediately via Signals.
---

