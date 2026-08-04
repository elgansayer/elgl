Priority: High Impact

Description: Define the Angular component hierarchy, routing structure, and state management approach for the settings system. This architecture ensures maintainability and high performance using Angular Signals for optimistic UI updates.

Technical Implementation:
1. **Component Hierarchy:** Implement a master-detail pattern where a main `SettingsLayoutComponent` handles navigation and acts as a container for specialized sub-components.

```
src/app/features/settings/
├── settings-layout/                  # Contains the sidebar navigation and router-outlet
├── account-settings/                 # Email, password, 2FA, sessions
├── profile-discovery-settings/       # Bio, language preferences, matching filters
├── social-privacy-settings/          # Visibility, DM controls, friend requests
├── app-preferences-settings/         # Theme, accessibility, media
└── notification-settings/            # Push and email toggles
```

2. **Routing Structure:** Use lazy loading for the settings feature module.

```typescript
const routes: Routes = [
  {
    path: 'settings',
    component: SettingsLayoutComponent,
    children: [
      { path: '', redirectTo: 'account', pathMatch: 'full' },
      { path: 'account', loadComponent: () => import('./account-settings.component').then(m => m.AccountSettingsComponent) },
      { path: 'profile', loadComponent: () => import('./profile-discovery-settings.component').then(m => m.ProfileDiscoverySettingsComponent) },
      { path: 'privacy', loadComponent: () => import('./social-privacy-settings.component').then(m => m.SocialPrivacySettingsComponent) },
      { path: 'preferences', loadComponent: () => import('./app-preferences-settings.component').then(m => m.AppPreferencesSettingsComponent) },
      { path: 'notifications', loadComponent: () => import('./notification-settings.component').then(m => m.NotificationSettingsComponent) },
    ]
  }
];
```

3. **State Management (Angular Signals):**
Given the memory guideline prioritizing Angular Signals for optimistic UI updates, we will implement a `SettingsService` that manages state using `signal()` or `DeepSignal`. For deeply nested changes (like a Discord-style DM filter toggle), updating a signal allows for immediate local UI reaction before API confirmation.

```typescript
// settings.service.ts
import { Injectable, signal, computed, WritableSignal } from '@angular/core';
import { UserSettings } from './user-settings.model';
import { HttpClient } from '@angular/common/http';
import { produce } from 'immer'; // Optional: Immer helps handle deep immutable updates

@Injectable({ providedIn: 'root' })
export class SettingsService {
  // Store the complete nested state
  private state: WritableSignal<UserSettings | null> = signal(null);

  // Expose computed signals for specific parts of the state to components
  readonly socialPrivacy = computed(() => this.state()?.social);

  constructor(private http: HttpClient) {}

  // Load initial settings
  loadSettings() {
    this.http.get<UserSettings>('/api/settings').subscribe(settings => {
      this.state.set(settings);
    });
  }

  // Optimistic UI Update Example for deeply nested setting
  updateAllowFromServerMembers(allow: boolean) {
    const previousState = this.state();
    if (!previousState) return;

    // 1. Optimistic Update (using Immer-like pattern or spreading)
    this.state.update(current => {
      if (!current) return current;
      return {
        ...current,
        social: {
          ...current.social,
          directMessages: {
            ...current.social.directMessages,
            allowFromServerMembers: allow
          }
        }
      };
    });

    // 2. API Call
    this.http.patch('/api/settings/social/dm', { allowFromServerMembers: allow })
      .subscribe({
        error: (err) => {
          // 3. Rollback on failure
          this.state.set(previousState);
          console.error('Failed to update setting', err);
        }
      });
  }
}
```
Using Angular Signals combined with an immutable update pattern provides a highly responsive UI where deeply nested toggle actions feel instantaneous (optimistic update), seamlessly rolling back if the network request fails.