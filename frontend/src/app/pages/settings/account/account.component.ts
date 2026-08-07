import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';
import { AccountSettings } from '../../../core/models/settings.model';
import { TranslatePipe } from '../../../services/translate.pipe';

@Component({
  selector: 'app-account-settings',
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountSettingsComponent {
  private fb = inject(FormBuilder);
  protected settingsService = inject(SettingsService);

  readonly successMessage = signal<string | null>(null);

  passwordForm = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: this.passwordMatchValidator },
  );

  twoFactorForm = this.fb.group({
    twoFactorEnabled: [false],
  });

  constructor() {
    const currentAccountState = this.settingsService.accountSettings();
    if (currentAccountState) {
      this.twoFactorForm.patchValue(
        { twoFactorEnabled: currentAccountState.twoFactorEnabled },
        { emitEvent: false },
      );
    }
  }

  passwordMatchValidator(g: AbstractControl) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value ? null : { mismatch: true };
  }

  updateTwoFactorSetting() {
    const newSettings: Partial<AccountSettings> = {
      twoFactorEnabled: this.twoFactorForm.value.twoFactorEnabled ?? false,
    };
    this.settingsService.updateAccountSettings(newSettings);
  }

  changePassword() {
    if (this.passwordForm.valid) {
      this.settingsService.updateAccountSettings({}).then(() => {
        this.passwordForm.reset();
        this.successMessage.set('settings.account.password.success');
        setTimeout(() => this.successMessage.set(null), 3000);
      });
    }
  }

  terminateSession() {
    const currentSessions = this.settingsService.accountSettings()?.activeSessions ?? 0;
    if (currentSessions > 0) {
      this.settingsService.updateAccountSettings({ activeSessions: currentSessions - 1 });
    }
  }
}
