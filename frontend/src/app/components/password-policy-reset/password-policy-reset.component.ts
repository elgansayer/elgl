import { Component, signal, computed, inject } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-password-policy-reset',
  standalone: true,
  template: `
    <div class="password-reset-container">
      <h2 class="title">{{ i18n.translate('password.resetTitle') }}</h2>

      <div class="field">
        <label for="new-password">{{ i18n.translate('password.newPassword') }}</label>
        <input
          id="new-password"
          type="password"
          [value]="newPassword()"
          (input)="onNewPasswordInput($event)"
        />
      </div>

      <ul class="requirements">
        <li [class.valid]="hasMinLength()" [class.invalid]="!hasMinLength()">
          <span class="icon">{{ hasMinLength() ? '✓' : '✗' }}</span>
          {{ i18n.translate('password.minLength') }}
        </li>
        <li [class.valid]="hasNumber()" [class.invalid]="!hasNumber()">
          <span class="icon">{{ hasNumber() ? '✓' : '✗' }}</span>
          {{ i18n.translate('password.hasNumber') }}
        </li>
        <li [class.valid]="hasSymbol()" [class.invalid]="!hasSymbol()">
          <span class="icon">{{ hasSymbol() ? '✓' : '✗' }}</span>
          {{ i18n.translate('password.hasSymbol') }}
        </li>
      </ul>

      <div class="field">
        <label for="confirm-password">{{ i18n.translate('password.confirmPassword') }}</label>
        <input
          id="confirm-password"
          type="password"
          [value]="confirmPassword()"
          (input)="onConfirmPasswordInput($event)"
        />
      </div>

      @if (confirmPassword().length > 0) {
        <div class="match-indicator" [class.valid]="passwordsMatch()" [class.invalid]="!passwordsMatch()">
          <span class="icon">{{ passwordsMatch() ? '✓' : '✗' }}</span>
          {{ i18n.translate('password.passwordsMatch') }}
        </div>
      }

      <button class="reset-btn" [disabled]="!allValid()" (click)="resetPassword()">
        {{ i18n.translate('password.resetBtn') }}
      </button>

      @if (successMessage()) {
        <div class="message success">{{ successMessage() }}</div>
      }
      @if (errorMessage()) {
        <div class="message error">{{ errorMessage() }}</div>
      }
    </div>
  `,
  styles: [`
    .password-reset-container {
      max-width: 400px;
      margin: 2rem auto;
      padding: 1.5rem;
      background: #1e1e1e;
      border-radius: 12px;
      color: #e0e0e0;
    }
    .title {
      margin-bottom: 1.5rem;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .field {
      margin-bottom: 1rem;
    }
    .field label {
      display: block;
      margin-bottom: 0.25rem;
      font-size: 0.875rem;
      color: #aaa;
    }
    .field input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #444;
      border-radius: 8px;
      background: #121212;
      color: #e0e0e0;
      outline: none;
    }
    .field input:focus {
      border-color: #7c3aed;
    }
    .requirements {
      list-style: none;
      padding: 0;
      margin: 0 0 1rem 0;
    }
    .requirements li {
      padding: 0.25rem 0;
      font-size: 0.875rem;
    }
    .icon {
      margin-inline-end: 0.35rem;
      font-weight: bold;
    }
    .valid .icon { color: #22c55e; }
    .invalid .icon { color: #ef4444; }
    .valid { color: #22c55e; }
    .invalid { color: #ef4444; }
    .match-indicator {
      margin-bottom: 1rem;
      font-size: 0.875rem;
    }
    .reset-btn {
      display: block;
      width: 100%;
      padding: 0.625rem;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #7c3aed, #a855f7);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
    .reset-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .message {
      margin-top: 0.75rem;
      padding: 0.5rem;
      border-radius: 8px;
      font-size: 0.875rem;
    }
    .message.success {
      background: #14532d;
      color: #bbf7d0;
    }
    .message.error {
      background: #7f1d1d;
      color: #fca5a5;
    }
  `],
})
export class PasswordPolicyResetComponent {
  protected readonly i18n = inject(I18nService);

  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly hasMinLength = computed(() => this.newPassword().length >= 8);
  readonly hasNumber = computed(() => /\d/.test(this.newPassword()));
  readonly hasSymbol = computed(() => /[!@#$%^&*(),.?":{}|<>]/.test(this.newPassword()));
  readonly passwordsMatch = computed(() => this.newPassword() === this.confirmPassword());
  readonly allValid = computed(() => this.hasMinLength() && this.hasNumber() && this.hasSymbol() && this.passwordsMatch());

  onNewPasswordInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.newPassword.set(target.value);
    }
  }

  onConfirmPasswordInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.confirmPassword.set(target.value);
    }
  }

  resetPassword(): void {
    // TODO: implement actual password update via Supabase or backend.
    this.successMessage.set(this.i18n.translate('password.resetSuccess'));
    this.errorMessage.set(null);
  }
}
