# Task: Build Settings Angular Architecture

* **Priority:** High Impact
* **Description:** Define the Angular component hierarchy, routing structure, state management approach (using Angular Signals), and provide an example of a deeply nested Reactive Form for handling settings optimally.

## Technical Implementation

### 1. Component Hierarchy and Routing Structure

The settings area should be lazy-loaded to optimize initial bundle size. We'll use a master-detail layout common in dense settings pages (like Discord).

```text
src/app/features/settings/
├── settings-routing.module.ts (or settings.routes.ts for standalone)
├── settings.component.ts (Layout: Sidebar nav + RouterOutlet for content)
├── settings.component.html
├── settings.component.scss
├── components/
│   ├── settings-sidebar/      (Navigation links)
│   ├── account-settings/      (Email, 2FA, Sessions)
│   ├── profile-settings/      (Bio, Languages, Discovery filters)
│   ├── privacy-settings/      (Visibility, DMs, Friend requests)
│   ├── appearance-settings/   (Theme, accessibility)
│   └── notification-settings/ (Push/Email toggles)
└── shared/
    └── setting-toggle/        (Reusable toggle component)
```

**Routing (settings.routes.ts):**

```typescript
import { Routes } from '@angular/router';
import { SettingsComponent } from './settings.component';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    component: SettingsComponent,
    children: [
      { path: '', redirectTo: 'account', pathMatch: 'full' },
      { path: 'account', loadComponent: () => import('./components/account-settings/account-settings.component').then(m => m.AccountSettingsComponent) },
      { path: 'profile', loadComponent: () => import('./components/profile-settings/profile-settings.component').then(m => m.ProfileSettingsComponent) },
      { path: 'privacy', loadComponent: () => import('./components/privacy-settings/privacy-settings.component').then(m => m.PrivacySettingsComponent) },
      { path: 'appearance', loadComponent: () => import('./components/appearance-settings/appearance-settings.component').then(m => m.AppearanceSettingsComponent) },
      { path: 'notifications', loadComponent: () => import('./components/notification-settings/notification-settings.component').then(m => m.NotificationSettingsComponent) }
    ]
  }
];
```

### 2. State Management (Angular Signals)

For a deeply nested settings state, we recommend using a centralized service managing state via Angular Signals. This allows for optimistic UI updates and efficient, fine-grained reactivity in the templates.

```typescript
// src/app/core/services/settings.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { UserSettings, SocialPrivacySettings } from '../models/settings.model';
import { SettingsApiService } from './settings-api.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private api = inject(SettingsApiService);

  // State
  private state = signal<UserSettings | null>(null);
  private loading = signal<boolean>(false);
  private error = signal<string | null>(null);

  // Selectors (computed signals)
  readonly settings = this.state.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly privacySettings = computed(() => this.state()?.social ?? null);
  readonly theme = computed(() => this.state()?.preferences.appearance.theme ?? 'System');

  // Actions
  async loadSettings(userId: string) {
    this.loading.set(true);
    try {
      const data = await this.api.fetchSettings(userId);
      this.state.set(data);
    } catch (e) {
      this.error.set('Failed to load settings');
    } finally {
      this.loading.set(false);
    }
  }

  // Optimistic Update Example
  async updatePrivacySettings(newSettings: Partial<SocialPrivacySettings>) {
    const currentState = this.state();
    if (!currentState) return;

    // 1. Optimistically update UI
    this.state.update(state => ({
      ...state!,
      social: { ...state!.social, ...newSettings }
    }));

    // 2. Perform API Call
    try {
      await this.api.patchPrivacySettings(newSettings);
      // Success: State is already correct
    } catch (e) {
      // 3. Rollback on failure
      this.error.set('Failed to update privacy settings. Reverting.');
      this.state.set(currentState);
    }
  }
}
```

### 3. Reactive Forms Implementation (Privacy Settings Example)

Use Angular Reactive Forms mapped to the deeply nested interface for complex form management, validation, and change tracking.

```typescript
// src/app/features/settings/components/privacy-settings/privacy-settings.component.ts
import { Component, inject, OnInit, effect } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '../../../../core/services/settings.service';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <h3>Direct Messages</h3>
      <label>
        <input type="checkbox" formControlName="allowFromServerMembers">
        Allow direct messages from server members
      </label>

      <label>
        Explicit Image Filter Level:
        <select formControlName="imageFilterLevel">
          <option value="All">Scan and delete</option>
          <option value="Blurred">Blur explicit images</option>
          <option value="None">Do not filter</option>
        </select>
      </label>

      <button (click)="save()" [disabled]="form.pristine">Save Changes</button>
    </form>
  `
})
export class PrivacySettingsComponent {
  private fb = inject(NonNullableFormBuilder);
  private settingsService = inject(SettingsService);

  form = this.fb.group({
    allowFromServerMembers: [false],
    imageFilterLevel: this.fb.control<'All' | 'Blurred' | 'None'>('Blurred')
  });

  constructor() {
    // Sync initial state from Signal to Form
    effect(() => {
      const privacyData = this.settingsService.privacySettings();
      if (privacyData) {
        this.form.patchValue({
          allowFromServerMembers: privacyData.directMessages.allowFromServerMembers,
          imageFilterLevel: privacyData.directMessages.imageFilterLevel
        }, { emitEvent: false }); // Prevent triggering valueChanges loop
      }
    });
  }

  save() {
    if (this.form.valid && this.form.dirty) {
      // Structure matches the API/Model expectation
      const updateData = {
        directMessages: {
          allowFromServerMembers: this.form.value.allowFromServerMembers!,
          imageFilterLevel: this.form.value.imageFilterLevel!
        }
      };

      this.settingsService.updatePrivacySettings(updateData);
      this.form.markAsPristine();
    }
  }
}
```
