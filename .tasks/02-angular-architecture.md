Priority: High Impact

Description:
Design the Angular architecture for the settings system, including component hierarchy, routing, and state management using Angular Signals for optimistic UI updates. Provide a Reactive Form example for the privacy settings.

Technical Implementation:

### Component Hierarchy and Routing

Create a nested routing structure under the `/settings` path to manage the various sections efficiently.

```typescript
// frontend/src/app/pages/settings/settings.routes.ts
import { Routes } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { AccountSettingsComponent } from './account/account-settings.component';
import { ProfileDiscoverySettingsComponent } from './profile-discovery/profile-discovery-settings.component';
import { SocialPrivacySettingsComponent } from './social-privacy/social-privacy-settings.component';
import { AppPreferencesSettingsComponent } from './app-preferences/app-preferences-settings.component';
import { NotificationSettingsComponent } from './notifications/notification-settings.component';

export const settingsRoutes: Routes = [
  {
    path: '',
    component: SettingsComponent,
    children: [
      { path: '', redirectTo: 'account', pathMatch: 'full' },
      { path: 'account', component: AccountSettingsComponent },
      { path: 'profile', component: ProfileDiscoverySettingsComponent },
      { path: 'privacy', component: SocialPrivacySettingsComponent },
      { path: 'preferences', component: AppPreferencesSettingsComponent },
      { path: 'notifications', component: NotificationSettingsComponent }
    ]
  }
];
```

The main `SettingsComponent` should act as a layout shell with a sidebar navigation for the child routes, similar to Discord's user settings layout.

### State Management (Angular Signals)

Utilize Angular Signals to handle state, particularly for optimistic UI updates when toggling settings. Create a `SettingsService`.

```typescript
// frontend/src/app/services/settings.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { UserSettings } from '../interfaces/settings.interface';

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private http = inject(HttpClient);

  // Initialize with sensible defaults or loaded state
  private state = signal<UserSettings | null>(null);

  // Expose readonly signals
  readonly settings = this.state.asReadonly();

  // Computed specific slices
  readonly privacySettings = computed(() => this.state()?.socialPrivacy);

  // Optimistic update example
  updatePrivacySetting(key: keyof UserSettings['socialPrivacy'], value: any) {
    const currentState = this.state();
    if (!currentState) return;

    // 1. Optimistic Update
    this.state.update(state => ({
      ...state!,
      socialPrivacy: {
        ...state!.socialPrivacy,
        [key]: value
      }
    }));

    // 2. API Call
    this.http.patch(`/api/settings/privacy`, { [key]: value }).subscribe({
      error: (err) => {
        // 3. Rollback on failure (simplified, consider maintaining previous state)
        console.error('Failed to update setting', err);
        this.state.set(currentState);
      }
    });
  }
}
```

### Reactive Form Implementation for Privacy Settings

```typescript
// frontend/src/app/pages/settings/social-privacy/social-privacy-settings.component.ts
import { Component, inject, effect, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '../../../services/settings.service';

@Component({
  selector: 'app-social-privacy-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="privacyForm">
      <h3>Direct Message Controls</h3>

      <label>
        Allow DMs from:
        <select formControlName="allowDMsFrom">
          <option value="everyone">Everyone</option>
          <option value="friends">Friends</option>
          <option value="server_members">Server Members</option>
        </select>
      </label>

      <label>
        Explicit Image Filtering:
        <div>
          <label><input type="radio" formControlName="explicitImageFiltering" value="strict"> Strict (Filter all)</label>
          <label><input type="radio" formControlName="explicitImageFiltering" value="blur"> Blur</label>
          <label><input type="radio" formControlName="explicitImageFiltering" value="off"> Off</label>
        </div>
      </label>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SocialPrivacySettingsComponent {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);

  privacyForm = this.fb.nonNullable.group({
    allowDMsFrom: [''],
    explicitImageFiltering: ['']
  });

  constructor() {
    // Sync Form with Signal state (initial load)
    effect(() => {
      const privacy = this.settingsService.privacySettings();
      if (privacy) {
        this.privacyForm.patchValue({
          allowDMsFrom: privacy.messaging.allowDMsFrom,
          explicitImageFiltering: privacy.messaging.explicitImageFiltering
        }, { emitEvent: false }); // Prevent triggering valueChanges loop
      }
    });

    // Handle Form changes and trigger optimistic updates
    this.privacyForm.valueChanges.subscribe(changes => {
       if (changes.allowDMsFrom) {
          // Note: In a real app, you might need a more robust way to update nested objects
          // This calls the service which handles the optimistic UI update logic
          // this.settingsService.updatePrivacySetting('messaging.allowDMsFrom', changes.allowDMsFrom);
       }
    });
  }
}
```
