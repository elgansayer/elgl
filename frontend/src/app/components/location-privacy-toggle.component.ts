import { Component, signal, inject } from '@angular/core';
import { TranslatePipe } from '../services/translate.pipe';
import { UserService } from '../services/user.service';

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
  private readonly userService = inject(UserService);

  async setLocationPrivacy(value: 'exact' | 'region'): Promise<void> {
    const previousValue = this.locationPrivacy();
    this.locationPrivacy.set(value);

    try {
      await this.userService.updatePrivacySettings({
        privacy_hide_exact_location: value === 'region',
      });
    } catch {
      this.locationPrivacy.set(previousValue);
    }
  }
}
