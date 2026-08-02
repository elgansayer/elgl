# Priority: High Impact

# Description
Design the component hierarchy, routing structure (integrating with the existing `SettingsComponent`), and state management approach for the Settings section. Implement a robust architecture utilizing Angular Signals for optimistic UI updates.

# Technical Implementation
## Component Hierarchy & Routing
Update `frontend/src/app/app.routes.ts` to include sub-routes under the main `settings` path, lazy-loading feature components:
```typescript
{
  path: 'settings',
  loadComponent: () => import('./components/settings/settings.component').then((m) => m.SettingsComponent),
  children: [
    { path: '', redirectTo: 'account', pathMatch: 'full' },
    { path: 'account', loadComponent: () => import('./components/settings/account-settings/account-settings.component').then(m => m.AccountSettingsComponent) },
    { path: 'profile', loadComponent: () => import('./components/settings/profile-settings/profile-settings.component').then(m => m.ProfileSettingsComponent) },
    { path: 'privacy', loadComponent: () => import('./components/settings/privacy-settings/privacy-settings.component').then(m => m.PrivacySettingsComponent) },
    { path: 'preferences', loadComponent: () => import('./components/settings/preferences-settings/preferences-settings.component').then(m => m.PreferencesSettingsComponent) },
    { path: 'notifications', loadComponent: () => import('./components/settings/notification-settings/notification-settings.component').then(m => m.NotificationSettingsComponent) }
  ]
}
```

## State Management (Angular Signals)
Create a `SettingsService` (`frontend/src/app/services/settings.service.ts`) using Angular Signals to manage state optimistically:
```typescript
import { Injectable, signal, computed } from '@angular/core';
import { UserSettings, SocialPrivacySettings } from '../models/settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private settingsSignal = signal<UserSettings | null>(null);

  readonly settings = this.settingsSignal.asReadonly();
  readonly privacySettings = computed(() => this.settingsSignal()?.privacy);

  // Optimistic update pattern
  async updatePrivacySettings(newPrivacy: SocialPrivacySettings) {
    const currentSettings = this.settingsSignal();
    if (!currentSettings) return;

    // 1. Optimistic update
    this.settingsSignal.update(s => s ? { ...s, privacy: newPrivacy } : s);

    try {
      // 2. API Call (mocked)
      // await this.http.put('/api/settings/privacy', newPrivacy).toPromise();
    } catch (error) {
      // 3. Rollback on failure
      this.settingsSignal.set(currentSettings);
      console.error('Failed to update privacy settings', error);
      // Show error toast
    }
  }
}
```

## Reactive Form Example (Privacy Settings)
Implementation for `privacy-settings.component.ts` utilizing `ChangeDetectionStrategy.OnPush`:
```typescript
import { Component, ChangeDetectionStrategy, effect, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';
import { SocialPrivacySettings } from '../../models/settings.model';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './privacy-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrivacySettingsComponent {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);

  privacyForm = this.fb.group({
    profileVisibility: ['everyone'],
    readReceiptsEnabled: [true],
    directMessageControls: this.fb.group({
      allowFromServerMembers: [true],
      explicitImageFilter: ['none']
    }),
    friendRequestControls: this.fb.group({
      allowFromEveryone: [true],
      allowFromFriendsOfFriends: [true],
      allowFromServerMembers: [true]
    })
  });

  constructor() {
    effect(() => {
      const currentPrivacy = this.settingsService.privacySettings();
      if (currentPrivacy) {
        this.privacyForm.patchValue(currentPrivacy, { emitEvent: false });
      }
    });

    this.privacyForm.valueChanges.subscribe((val) => {
      if (this.privacyForm.valid) {
        this.settingsService.updatePrivacySettings(val as SocialPrivacySettings);
      }
    });
  }
}
```
