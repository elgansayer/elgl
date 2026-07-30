import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService } from '../../services/user.service';
import { resource } from '@angular/core';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="max-w-lg mx-auto p-4">
      <h1 class="text-2xl font-bold mb-2">{{ 'privacy.title' | t }}</h1>
      <p class="text-muted mb-6">{{ 'privacy.subtitle' | t }}</p>

      @if (profileResource.error()) {
        <div class="bg-red-500/20 text-red-300 p-3 rounded mb-4">
          {{ 'privacy.loadError' | t }}
        </div>
      }

      <div class="space-y-4">
        <label class="flex items-center justify-between">
          <span>{{ 'privacy.hideAge' | t }}</span>
          <input
            type="checkbox"
            [checked]="hideAge()"
            (change)="hideAge.set($event.target.checked)"
            class="toggle-checkbox"
          />
        </label>
        <label class="flex items-center justify-between">
          <span>{{ 'privacy.hideLocation' | t }}</span>
          <input
            type="checkbox"
            [checked]="hideLocation()"
            (change)="hideLocation.set($event.target.checked)"
            class="toggle-checkbox"
          />
        </label>
        <label class="flex items-center justify-between">
          <span>{{ 'privacy.hideFromSearch' | t }}</span>
          <input
            type="checkbox"
            [checked]="hideFromSearch()"
            (change)="hideFromSearch.set($event.target.checked)"
            class="toggle-checkbox"
          />
        </label>
        <label class="flex items-center justify-between">
          <span>{{ 'privacy.hideGender' | t }}</span>
          <input
            type="checkbox"
            [checked]="hideGender()"
            (change)="hideGender.set($event.target.checked)"
            class="toggle-checkbox"
          />
        </label>
        <label class="flex items-center justify-between">
          <span>{{ 'privacy.hideExactLocation' | t }}</span>
          <input
            type="checkbox"
            [checked]="hideExactLocation()"
            (change)="hideExactLocation.set($event.target.checked)"
            class="toggle-checkbox"
          />
        </label>
        <div class="space-y-2">
          <label>{{ 'privacy.statusVisibility' | t }}</label>
          <select
            [value]="statusVisibility()"
            (change)="statusVisibility.set($any($event.target).value)"
            class="block w-full bg-surface border border-border rounded px-3 py-2 mt-1"
          >
            <option value="everyone">{{ 'privacy.statusEveryone' | t }}</option>
            <option value="follower_only">{{ 'privacy.statusFollowers' | t }}</option>
            <option value="vips_only">{{ 'privacy.statusVipsOnly' | t }}</option>
            <option value="hidden">{{ 'privacy.statusHidden' | t }}</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        class="btn-primary w-full mt-6 py-2 rounded-lg"
        [disabled]="isSaving()"
        (click)="save()"
      >
        @if (isSaving()) {
          <span class="loading-spinner"></span>
        }
        {{ (isSaving() ? 'privacy.saving' : 'privacy.saveBtn') | t }}
      </button>
    </div>
  `,
})
export class PrivacySettingsComponent {
  private userService = inject(UserService);

  hideAge = signal(false);
  hideLocation = signal(false);
  hideFromSearch = signal(false);
  hideGender = signal(false);
  hideExactLocation = signal(false);
  statusVisibility = signal('everyone');
  isSaving = signal(false);

  profileResource = resource({
    loader: () => this.userService.getMyProfile(),
  });

  constructor() {
    effect(() => {
      const profile = this.profileResource.value();
      if (profile) {
        this.hideAge.set(profile.privacy_hide_age);
        this.hideLocation.set(profile.privacy_hide_location);
        this.hideFromSearch.set(profile.privacy_hide_from_search);
        this.hideGender.set(profile.privacy_hide_gender);
        this.hideExactLocation.set(profile.privacy_hide_exact_location ?? false);
        this.statusVisibility.set(profile.status_visibility ?? 'everyone');
      }
    });
  }

  async save(): Promise<void> {
    this.isSaving.set(true);
    try {
      await this.userService.updateMyProfile({
        privacy_hide_age: this.hideAge(),
        privacy_hide_location: this.hideLocation(),
        privacy_hide_from_search: this.hideFromSearch(),
        privacy_hide_gender: this.hideGender(),
        privacy_hide_exact_location: this.hideExactLocation(),
        status_visibility: this.statusVisibility(),
      });
    } catch {
      console.error('Failed to save privacy settings');
    } finally {
      this.isSaving.set(false);
    }
  }
}
