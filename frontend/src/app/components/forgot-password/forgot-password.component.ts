import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, RouterLink, ...HlmButtonImports, ...HlmInputImports],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-surface p-4">
      <div class="w-full max-w-md space-y-6">
        <h1 class="text-center text-3xl font-bold text-text-primary">{{ 'forgot_password.title' | t }}</h1>

        @if (!tokenQuery()) {
          <form
            [formGroup]="emailForm"
            (ngSubmit)="sendResetRequest()"
            class="space-y-4"
            [attr.aria-busy]="isSending()"
          >
            <div>
              <label for="email" class="block text-sm font-medium text-text-secondary">{{ 'forgot_password.email_label' | t }}</label>
              <input
                hlmInput
                id="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                maxlength="254"
                formControlName="email"
                required
                class="mt-1"
              />
            </div>

            @if (sendError()) {
              <p role="alert" class="text-sm text-error">{{ sendError() ?? '' | t }}</p>
            }
            @if (sendSuccess()) {
              <p role="status" aria-live="polite" class="text-sm text-success">{{ 'forgot_password.sent_message' | t }}</p>
            }

            <button hlmBtn type="submit" size="touch" class="w-full" [disabled]="emailForm.invalid || isSending()">
              {{ (isSending() ? 'forgot_password.sending' : 'forgot_password.send_button') | t }}
            </button>
          </form>
        } @else {
          <form
            [formGroup]="resetForm"
            (ngSubmit)="doPasswordReset()"
            class="space-y-4"
            [attr.aria-busy]="isResetting()"
          >
            <div>
              <label for="newPassword" class="block text-sm font-medium text-text-secondary">{{ 'forgot_password.new_password_label' | t }}</label>
              <input
                hlmInput
                id="newPassword"
                type="password"
                autocomplete="new-password"
                formControlName="newPassword"
                required
                minlength="8"
                maxlength="128"
                class="mt-1"
              />
            </div>

            @if (resetError()) {
              <p role="alert" class="text-sm text-error">{{ resetError() ?? '' | t }}</p>
            }
            @if (resetSuccess()) {
              <p role="status" aria-live="polite" class="text-sm text-success">{{ 'forgot_password.reset_success' | t }}</p>
            }

            <button hlmBtn type="submit" size="touch" class="w-full" [disabled]="resetForm.invalid || isResetting()">
              {{ (isResetting() ? 'forgot_password.resetting' : 'forgot_password.reset_button') | t }}
            </button>
          </form>
        }

        <div class="text-center">
          <a hlmBtn variant="link" routerLink="/home">{{ 'forgot_password.back_to_home' | t }}</a>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tokenQuery = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('token'))));
  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });
  readonly resetForm = this.fb.nonNullable.group({
    newPassword: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    ],
  });

  readonly isSending = signal(false);
  readonly sendError = signal<string | null>(null);
  readonly sendSuccess = signal(false);
  readonly isResetting = signal(false);
  readonly resetError = signal<string | null>(null);
  readonly resetSuccess = signal(false);

  async sendResetRequest(): Promise<void> {
    if (this.emailForm.invalid || this.isSending()) return;

    const email = this.emailForm.controls.email.value.trim().toLowerCase();
    if (!email) return;

    this.emailForm.controls.email.setValue(email, { emitEvent: false });
    this.isSending.set(true);
    this.sendError.set(null);
    this.sendSuccess.set(false);
    try {
      await this.authService.requestPasswordReset(email);
      this.sendSuccess.set(true);
    } catch {
      this.sendError.set('forgot_password.send_error');
    } finally {
      this.isSending.set(false);
    }
  }

  async doPasswordReset(): Promise<void> {
    if (this.resetForm.invalid || this.isResetting()) return;

    const token = this.tokenQuery()?.trim() ?? '';
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      this.resetError.set('forgot_password.reset_error');
      return;
    }

    this.isResetting.set(true);
    this.resetError.set(null);
    this.resetSuccess.set(false);
    try {
      await this.authService.resetPassword(token, this.resetForm.controls.newPassword.value);
      this.resetSuccess.set(true);
      await this.router.navigate(['/home']);
    } catch {
      this.resetError.set('forgot_password.reset_error');
    } finally {
      this.isResetting.set(false);
    }
  }
}
