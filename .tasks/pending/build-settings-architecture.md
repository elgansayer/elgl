* Priority: High Impact
* Description: Architect the Angular component hierarchy, routing, and state management for the settings area.
* Technical Implementation:
  1. **Routing Strategy**: Leverage the existing `/settings` base route (in `app.routes.ts`) acting as a shell. The layout should include a side navigation (Discord style) routing to child components (e.g., `settings/account`, `settings/profile`, `settings/privacy`, `settings/appearance`, `settings/notification`).
  2. **State Management**: Utilize Angular Signals for reactive, optimistic UI updates. Create a `SettingsService` holding the `SettingsState` as a writable signal (`signal<SettingsState>`). When a deeply nested setting toggles, update the signal state immediately (optimistic UI), make the backend call, and rollback the signal state if the backend request fails.
  3. **Reactive Forms**: Use Angular Reactive Forms for complex sections.

**Reactive Form Example (Privacy Settings):**
```typescript
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="privacyForm">
      <h3>Direct Messages</h3>
      <label>
        <input type="checkbox" formControlName="allowFromServerMembers" (change)="updateSetting()">
        Allow Direct Messages from Server Members
      </label>

      <h3>Explicit Image Filter</h3>
      <select formControlName="explicitImageFilter" (change)="updateSetting()">
        <option value="all">Filter all DMs</option>
        <option value="non_friends">Filter DMs from non-friends</option>
        <option value="off">Do not filter</option>
      </select>
    </form>
  `
})
export class PrivacySettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);

  privacyForm = this.fb.group({
    allowFromServerMembers: [false],
    explicitImageFilter: ['non_friends']
  });

  ngOnInit() {
    // Populate form from signal state initially (assuming untracked/snapshot pattern or effect)
    const currentSocialState = this.settingsService.settingsState().social;
    this.privacyForm.patchValue({
      allowFromServerMembers: currentSocialState.dmControls.allowFromServerMembers,
      explicitImageFilter: currentSocialState.dmControls.explicitImageFilter
    }, { emitEvent: false });
  }

  updateSetting() {
    // 1. Optimistic Update via Signal
    this.settingsService.updateDmControls(this.privacyForm.value);

    // 2. Make API Call (handled in service, which rolls back state on error)
    this.settingsService.saveSettings().subscribe({
      error: () => {
         // Revert form UI to actual valid state
         const revertedState = this.settingsService.settingsState().social;
         this.privacyForm.patchValue(revertedState.dmControls, { emitEvent: false });
      }
    });
  }
}
```
