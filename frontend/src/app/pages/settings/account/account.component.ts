import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';
import { AccountSettings } from '../../../core/models/settings.model';
import { TranslatePipe } from '../../../services/translate.pipe';

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [HlmCheckbox, HlmInput, HlmButton, ReactiveFormsModule, TranslatePipe],
  templateUrl: './account.component.html',
  styleUrls: ['./account.component.scss'],
})
export class AccountSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  public settingsService = inject(SettingsService);
  readonly successMessage = signal('');

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

  ngOnInit() {
    const currentAccountState = this.settingsService.accountSettings();
    if (currentAccountState) {
      this.twoFactorForm.patchValue(
        {
          twoFactorEnabled: currentAccountState.twoFactorEnabled,
        },
        { emitEvent: false },
      );
    }
  }

  passwordMatchValidator(g: AbstractControl) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value
      ? null
      : { mismatch: true };
  }

  updateTwoFactorSetting() {
    const newSettings: Partial<AccountSettings> = {
      twoFactorEnabled: this.twoFactorForm.value.twoFactorEnabled ?? false,
    };
    this.settingsService.updateAccountSettings(newSettings);
  }

  changePassword() {
    if (this.passwordForm.valid) {
      // In a real app, you'd call a service method to change password here
      // For this UI, we just reset the form on success (simulated)
      console.warn('Password changed mock'); // Using warn to avoid no-console rule for log
      this.settingsService.updateAccountSettings({});
      this.successMessage.set('settings.account.password.success');
      this.passwordForm.reset();
    }
  }

  terminateSession() {
    // Optimistic UI for active sessions
    const currentSessions = this.settingsService.accountSettings()?.activeSessions ?? 0;
    if (currentSessions > 0) {
      this.settingsService.updateAccountSettings({
        activeSessions: currentSessions - 1,
      });
    }
  }
}
