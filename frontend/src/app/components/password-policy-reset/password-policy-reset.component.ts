import { Component, signal, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

function getInputValue(event: Event): string {
  const target = event.target;
  return target instanceof HTMLInputElement ? target.value : '';
}

@Component({
  selector: 'app-password-policy-reset',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="max-w-md mx-auto my-8 p-6 rounded-xl" style="background: #1e1e1e; color: #e0e0e0;">
      <h2 class="mb-6 text-xl font-semibold">{{ 'password.resetTitle' | t }}</h2>

      <div class="mb-4">
        <label for="current-password" class="block mb-1 text-sm" style="color: #aaa;">{{ 'password.currentPassword' | t }}</label>
        <input
          id="current-password"
          type="password"
          [value]="currentPassword()"
          (input)="onCurrentPasswordChange($event)"
          class="w-full p-2 rounded-lg outline-none"
          style="border: 1px solid #444; background: #121212; color: #e0e0e0;"
        />
      </div>

      <div class="mb-4">
        <label for="new-password" class="block mb-1 text-sm" style="color: #aaa;">{{ 'password.newPassword' | t }}</label>
        <input
          id="new-password"
          type="password"
          [value]="newPassword()"
          (input)="onNewPasswordChange($event)"
          class="w-full p-2 rounded-lg outline-none"
          style="border: 1px solid #444; background: #121212; color: #e0e0e0;"
        />
      </div>

      <ul class="list-none p-0 mb-4">
        <li class="py-1 text-sm" [class]="hasMinLength() ? 'text-green-500' : 'text-red-500'">
          <span class="me-1 font-bold">{{ hasMinLength() ? '✓' : '✗' }}</span>
          {{ 'password.minLength' | t }}
        </li>
        <li class="py-1 text-sm" [class]="hasNumber() ? 'text-green-500' : 'text-red-500'">
          <span class="me-1 font-bold">{{ hasNumber() ? '✓' : '✗' }}</span>
          {{ 'password.hasNumber' | t }}
        </li>
        <li class="py-1 text-sm" [class]="hasSymbol() ? 'text-green-500' : 'text-red-500'">
          <span class="me-1 font-bold">{{ hasSymbol() ? '✓' : '✗' }}</span>
          {{ 'password.hasSymbol' | t }}
        </li>
      </ul>

      <div class="mb-4">
        <label for="confirm-password" class="block mb-1 text-sm" style="color: #aaa;">{{ 'password.confirmPassword' | t }}</label>
        <input
          id="confirm-password"
          type="password"
          [value]="confirmPassword()"
          (input)="onConfirmPasswordChange($event)"
          class="w-full p-2 rounded-lg outline-none"
          style="border: 1px solid #444; background: #121212; color: #e0e0e0;"
        />
      </div>

      @if (confirmPassword().length > 0) {
        <div class="mb-4 text-sm" [class]="passwordsMatch() ? 'text-green-500' : 'text-red-500'">
          <span class="me-1 font-bold">{{ passwordsMatch() ? '✓' : '✗' }}</span>
          {{ 'password.passwordsMatch' | t }}
        </div>
      }

      <button
        class="block w-full py-2.5 rounded-lg text-white font-semibold cursor-pointer"
        [disabled]="!allValid() || isSubmitting()"
        [style.opacity]="(!allValid() || isSubmitting()) ? 0.4 : 1"
        style="background: linear-gradient(135deg, #7c3aed, #a855f7);"
        (click)="resetPassword()"
      >
        {{ 'password.resetBtn' | t }}
      </button>

      @if (successMessage()) {
        <div class="mt-3 p-2 rounded-lg text-sm" style="background: #14532d; color: #bbf7d0;">{{ successMessage()! | t }}</div>
      }
      @if (errorMessage()) {
        <div class="mt-3 p-2 rounded-lg text-sm" style="background: #7f1d1d; color: #fca5a5;">{{ errorMessage()! | t }}</div>
      }
    </div>
  `,
})
export class PasswordPolicyResetComponent {
  private readonly authService = inject(AuthService);

  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly currentPassword = signal('');
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isSubmitting = signal(false);

  readonly hasMinLength = computed(() => this.newPassword().length >= 8);
  readonly hasNumber = computed(() => /\d/.test(this.newPassword()));
  readonly hasSymbol = computed(() => /[!@#$%^&*(),.?":{}|<>]/.test(this.newPassword()));
  readonly passwordsMatch = computed(() => this.newPassword() === this.confirmPassword());
  readonly allValid = computed(() => this.hasMinLength() && this.hasNumber() && this.hasSymbol() && this.passwordsMatch());

  onCurrentPasswordChange(event: Event): void {
    this.currentPassword.set(getInputValue(event));
  }

  onNewPasswordChange(event: Event): void {
    this.newPassword.set(getInputValue(event));
  }

  onConfirmPasswordChange(event: Event): void {
    this.confirmPassword.set(getInputValue(event));
  }

  async resetPassword(): Promise<void> {
    if (!this.allValid() || this.isSubmitting()) return;
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      await this.authService.changePassword(this.currentPassword(), this.newPassword());
      this.successMessage.set('password.resetSuccess');
    } catch {
      this.errorMessage.set('password.resetError');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
