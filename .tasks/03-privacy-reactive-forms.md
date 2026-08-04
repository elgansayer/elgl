Priority: Medium Impact

Description: Provide a specific implementation example of a Reactive Form for the `Social & Privacy` settings component to handle deeply nested form structures, syncing values between the form and the signal-based state manager.

Technical Implementation:
Use Angular's `FormBuilder` (specifically the typed forms API) to mirror the nested `SocialPrivacySettings` structure. Listen to form `valueChanges` or specific control toggles to trigger the optimistic UI updates via the `SettingsService`.

```typescript
// social-privacy-settings.component.ts
import { Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { SettingsService } from '../settings.service';

@Component({
  selector: 'app-social-privacy-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="privacyForm">
      <section>
        <h3>Direct Message Controls</h3>
        <div formGroupName="directMessages">
          <label>
            <input type="checkbox" formControlName="allowFromServerMembers" (change)="onDmToggleChange()">
            Allow direct messages from server members
          </label>
        </div>
      </section>

      <!-- Other sections for profileVisibility, status, friendRequests -->
    </form>
  `,
  // Use OnPush change detection for primitive/presentational UI components as per memory guidelines
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SocialPrivacySettingsComponent {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);

  // Define the Typed Form reflecting the nested interface
  privacyForm = this.fb.group({
    profileVisibility: new FormControl<'everyone' | 'friends' | 'server_members' | 'nobody'>('everyone'),
    directMessages: this.fb.group({
      allowFromServerMembers: new FormControl<boolean>(true),
      explicitImageFilters: new FormControl<'blur' | 'block' | 'off'>('blur')
    }),
    friendRequests: this.fb.group({
      allowFromEveryone: new FormControl<boolean>(true),
      allowFromFriendsOfFriends: new FormControl<boolean>(true),
      allowFromServerMembers: new FormControl<boolean>(true)
    })
  });

  constructor() {
    // Sync external state updates (from Signals) into the form
    // The effect runs whenever settingsService.socialPrivacy() changes.
    effect(() => {
      const socialSettings = this.settingsService.socialPrivacy();
      if (socialSettings) {
        // Use patchValue to update the form without emitting events back to avoid infinite loops
        this.privacyForm.patchValue(socialSettings, { emitEvent: false });
      }
    });
  }

  // Handle local UI toggles to trigger optimistic updates
  onDmToggleChange() {
    const dmGroup = this.privacyForm.get('directMessages');
    const allow = dmGroup?.get('allowFromServerMembers')?.value;

    if (allow !== undefined && allow !== null) {
      this.settingsService.updateAllowFromServerMembers(allow);
    }
  }
}
```
This demonstrates syncing nested signal state into a strongly-typed Reactive Form, ensuring the UI remains reactive and the data is safely bound without infinite update cycles.