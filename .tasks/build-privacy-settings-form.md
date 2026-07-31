* Priority: Medium Impact
* Description: Implement a Reactive Form example for managing complex Privacy settings, reflecting the Discord-style permissions.
* Technical Implementation:
Use Angular's `FormBuilder` to create a nested `FormGroup`. Tie it to the Signals state management layer to trigger optimistic updates when values change.

```typescript
import { Component, effect, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsStore } from '../settings.store';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="privacyForm" class="p-4 space-y-6">
      <!-- Visibility Section -->
      <section>
        <h3 class="text-lg font-medium">Profile Visibility</h3>
        <select formControlName="profileVisibility" class="mt-2 p-2 border rounded">
          <option value="public">Public</option>
          <option value="friends">Friends Only</option>
          <option value="server_members">Server Members</option>
          <option value="private">Private</option>
        </select>
      </section>

      <!-- Direct Messages Section -->
      <section formGroupName="directMessages" class="space-y-4">
        <h3 class="text-lg font-medium">Direct Messages</h3>
        <label class="flex items-center space-x-2">
          <input type="checkbox" formControlName="allowFromServerMembers">
          <span>Allow DMs from server members</span>
        </label>

        <div>
          <label class="block mb-1">Explicit Image Filters</label>
          <select formControlName="explicitImageFilters" class="p-2 border rounded">
             <option value="none">None (Do not scan)</option>
             <option value="friends_only">Friends Only (Scan non-friends)</option>
             <option value="all">All (Scan all DMs)</option>
          </select>
        </div>
      </section>

      <!-- Friend Requests Section -->
      <section formGroupName="friendRequests" class="space-y-2">
        <h3 class="text-lg font-medium">Who can send you a friend request</h3>
        <label class="flex items-center space-x-2">
          <input type="checkbox" formControlName="everyone">
          <span>Everyone</span>
        </label>
        <label class="flex items-center space-x-2">
          <input type="checkbox" formControlName="friendsOfFriends">
          <span>Friends of Friends</span>
        </label>
        <label class="flex items-center space-x-2">
          <input type="checkbox" formControlName="serverMembers">
          <span>Server Members</span>
        </label>
      </section>
    </form>
  `
})
export class PrivacySettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  readonly store = inject(SettingsStore);

  privacyForm: FormGroup = this.fb.group({
    profileVisibility: [''],
    customStatus: this.fb.group({
      state: [''],
      emoji: [''],
      text: ['']
    }),
    readReceipts: [false],
    directMessages: this.fb.group({
      allowFromServerMembers: [true],
      explicitImageFilters: ['all']
    }),
    friendRequests: this.fb.group({
      everyone: [false],
      friendsOfFriends: [true],
      serverMembers: [true]
    })
  });

  constructor() {
    // Populate form when store settings are loaded
    effect(() => {
      const settings = this.store.settings();
      if (settings?.privacy) {
        this.privacyForm.patchValue(settings.privacy, { emitEvent: false });
      }
    });
  }

  ngOnInit() {
    // Listen for form changes to trigger optimistic updates
    this.privacyForm.valueChanges
      .pipe(
        debounceTime(500), // Prevent spamming updates on rapid changes
        takeUntilDestroyed()
      )
      .subscribe(formValue => {
        if (this.privacyForm.valid) {
          // Dispatch optimistic update to the Signal Store
          this.store.updatePrivacySetting(formValue);
        }
      });
  }
}
```