import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, effect } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '../../../../core/services/settings.service';

@Component({
  selector: 'app-privacy-settings',
  standalone: true,
  imports: [HlmCheckbox, HlmNativeSelect, HlmButton, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <h3>Direct Messages</h3>
      <label>
        <hlm-checkbox formControlName="allowFromServerMembers" />
        Allow direct messages from server members
      </label>

      <label>
        Explicit Image Filter Level:
        <hlm-native-select formControlName="imageFilterLevel">
          <option value="All">Scan and delete</option>
          <option value="Blurred">Blur explicit images</option>
          <option value="None">Do not filter</option>
        </hlm-native-select>
      </label>

      <button hlmBtn (click)="save()" [disabled]="form.pristine">Save Changes</button>
    </form>
  `,
})
export class PrivacySettingsComponent {
  private fb = inject(NonNullableFormBuilder);
  private settingsService = inject(SettingsService);

  form = this.fb.group({
    allowFromServerMembers: [false],
    imageFilterLevel: this.fb.control<'All' | 'Blurred' | 'None'>('Blurred'),
  });

  constructor() {
    // Sync initial state from Signal to Form
    effect(() => {
      const privacyData = this.settingsService.privacySettings();
      if (privacyData) {
        this.form.patchValue(
          {
            allowFromServerMembers: privacyData.directMessages.allowFromServerMembers,
            imageFilterLevel: privacyData.directMessages.imageFilterLevel,
          },
          { emitEvent: false },
        ); // Prevent triggering valueChanges loop
      }
    });
  }

  save() {
    if (this.form.valid && this.form.dirty) {
      // Structure matches the API/Model expectation
      const updateData = {
        directMessages: {
          allowFromServerMembers: this.form.value.allowFromServerMembers!,
          imageFilterLevel: this.form.value.imageFilterLevel!,
        },
      };

      this.settingsService.updatePrivacySettings(updateData);
      this.form.markAsPristine();
    }
  }
}
