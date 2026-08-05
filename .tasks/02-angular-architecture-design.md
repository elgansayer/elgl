* Priority: High Impact
* Description: Architect the Angular module for the Settings area, including routing, component hierarchy, state management using Signals (for optimistic updates), and Reactive Forms integration.
* Technical Implementation:
  1. **Component Hierarchy & Routing**: Create a layout component (`SettingsLayoutComponent`) with a sidebar for navigation (like Discord). Child routes should load specific sections (`AccountComponent`, `ProfileComponent`, `PrivacyComponent`, etc.).
  ```typescript
  // frontend/src/app/settings/settings-routing.module.ts
  const routes: Routes = [
    {
      path: 'settings',
      component: SettingsLayoutComponent,
      children: [
        { path: 'account', component: AccountComponent },
        { path: 'profile', component: ProfileComponent },
        { path: 'privacy', component: PrivacyComponent },
        // ... other routes
        { path: '', redirectTo: 'account', pathMatch: 'full' }
      ]
    }
  ];
  ```

  2. **State Management (Angular Signals)**: Utilize Angular Signals in a dedicated `SettingsService` to manage the settings state globally. This allows for synchronous optimistic UI updates while the backend request is in flight.
  ```typescript
  // frontend/src/app/core/services/settings.service.ts
  import { Injectable, signal, computed, inject } from '@angular/core';
  import { HttpClient } from '@angular/common/http';
  import { UserSettings } from '../models/settings.model';

  @Injectable({ providedIn: 'root' })
  export class SettingsService {
    private http = inject(HttpClient);

    // State
    private settingsState = signal<UserSettings | null>(null);
    public settings = this.settingsState.asReadonly();

    // Computed states for specific sections
    public privacySettings = computed(() => this.settingsState()?.socialPrivacy);

    // Optimistic Update Method
    updatePrivacySettings(newPrivacy: Partial<SocialPrivacySettings>) {
      const current = this.settingsState();
      if (!current) return;

      // 1. Optimistic Update
      this.settingsState.update(state => ({
        ...state!,
        socialPrivacy: { ...state!.socialPrivacy, ...newPrivacy }
      }));

      // 2. API Call
      this.http.patch('/api/settings/privacy', newPrivacy).subscribe({
        error: (err) => {
          // 3. Rollback on failure
          this.settingsState.set(current);
          // Show error toast
        }
      });
    }
  }
  ```

  3. **Reactive Forms Example (Privacy Settings)**:
  ```typescript
  // frontend/src/app/settings/privacy/privacy.component.ts
  import { Component, effect, inject } from '@angular/core';
  import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
  import { SettingsService } from '../../core/services/settings.service';

  @Component({
    selector: 'app-privacy-settings',
    standalone: true,
    imports: [ReactiveFormsModule],
    template: `
      <form [formGroup]="privacyForm">
        <h3>Direct Messages</h3>
        <label>
          <input type="checkbox" formControlName="allowFromServerMembers">
          Allow DMs from server members
        </label>

        <label>Explicit Image Filter</label>
        <select formControlName="explicitImageFilter">
          <option value="all">Filter all</option>
          <option value="non-friends">Filter non-friends</option>
          <option value="none">Do not filter</option>
        </select>
      </form>
    `
  })
  export class PrivacyComponent {
    private fb = inject(FormBuilder);
    private settingsService = inject(SettingsService);

    privacyForm = this.fb.group({
      allowFromServerMembers: [false],
      explicitImageFilter: ['non-friends']
    });

    constructor() {
      // Sync form with Signal state
      effect(() => {
        const privacy = this.settingsService.privacySettings();
        if (privacy) {
          this.privacyForm.patchValue({
             allowFromServerMembers: privacy.directMessages.allowFromServerMembers,
             explicitImageFilter: privacy.directMessages.explicitImageFilter
          }, { emitEvent: false }); // Prevent infinite loop
        }
      });

      // Listen to form changes to trigger optimistic updates
      this.privacyForm.valueChanges.subscribe(value => {
         // Construct partial update
         const update = {
            directMessages: {
                allowFromServerMembers: value.allowFromServerMembers ?? false,
                explicitImageFilter: (value.explicitImageFilter as any) ?? 'non-friends'
            }
         };
         this.settingsService.updatePrivacySettings(update);
      });
    }
  }
  ```