import { Component, signal, inject } from '@angular/core';
import { HlmRadioGroupImports } from '@spartan-ng/helm/radio-group';
import { TranslatePipe } from '../services/translate.pipe';
import { UserService } from '../services/user.service';

@Component({
  selector: 'app-location-privacy-toggle',
  template: `
    <fieldset class="flex flex-col gap-2">
      <legend class="font-medium">{{ 'settings.locationPrivacy' | t }}</legend>
      <hlm-radio-group
        class="flex items-center gap-4"
        name="locationPrivacy"
        [value]="locationPrivacy()"
        (valueChange)="setLocationPrivacy($any($event))"
      >
        <label class="flex cursor-pointer items-center gap-2">
          <hlm-radio value="exact" inputId="location-privacy-exact">
            <hlm-radio-indicator indicator />
          </hlm-radio>
          <span>{{ 'settings.locationPrivacy.exact' | t }}</span>
        </label>
        <label class="flex cursor-pointer items-center gap-2">
          <hlm-radio value="region" inputId="location-privacy-region">
            <hlm-radio-indicator indicator />
          </hlm-radio>
          <span>{{ 'settings.locationPrivacy.region' | t }}</span>
        </label>
      </hlm-radio-group>
    </fieldset>
  `,
  imports: [TranslatePipe, ...HlmRadioGroupImports],
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
