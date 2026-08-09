import { Component, signal } from '@angular/core';
import { TranslatePipe } from '../services/translate.pipe';

@Component({
  selector: 'app-location-privacy-toggle',
  template: `
    <fieldset class="flex flex-col gap-2">
      <legend class="font-medium">{{ 'settings.locationPrivacy' | t }}</legend>
      <div class="flex items-center gap-4">
        <label class="cursor-pointer">
          <input
            type="radio"
            name="locationPrivacy"
            [checked]="locationPrivacy() === 'exact'"
            (change)="setLocationPrivacy('exact')"
          />
          {{ 'settings.locationPrivacy.exact' | t }}
        </label>
        <label class="cursor-pointer">
          <input
            type="radio"
            name="locationPrivacy"
            [checked]="locationPrivacy() === 'region'"
            (change)="setLocationPrivacy('region')"
          />
          {{ 'settings.locationPrivacy.region' | t }}
        </label>
      </div>
    </fieldset>
  `,
  imports: [TranslatePipe],
})
export class LocationPrivacyToggleComponent {
  public readonly locationPrivacy = signal<'exact' | 'region'>('exact');

  setLocationPrivacy(value: 'exact' | 'region'): void {
    this.locationPrivacy.set(value);
    // TODO: Add backend integration to persist the setting.
    // Ensure the backend service is updated to save this setting.
  }
}
