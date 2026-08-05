import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-surface p-4">
      <div class="max-w-md w-full space-y-6">
        <h1 class="text-3xl font-bold text-center text-text-primary">{{ 'forgot_password.title' | t }}</h1>

        @if (!tokenQuery()) {
          <!-- Email form: step 1 - request reset link -->
          <form [formGroup]="emailForm" (ngSubmit)="sendResetRequest()" class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-text-secondary">{{
                'forgot_password.email_label' | t
              }}</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                required
                class="mt-1 block w-full rounded-md border border-border bg-input text-text-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            @if (sendError(); as error) {
              <p class="text-error text-sm">{{ error }}</p>
            }
            @if (sendSuccess()) {
              <p class="text-success text-sm">{{ 'forgot_password.sent_message' | t }}</p>
            }

            <button
              type="submit"
              [disabled]="emailForm.invalid || isSending()"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
            >
              {{ (isSending() ? 'forgot_password.sending' : 'forgot_password.send_button') | t }}
            </button>
          </form>
        } @else {
          <!-- Reset form: step 2 - set new password using token from email link -->
          <form [formGroup]="resetForm" (ngSubmit)="doPasswordReset()" class="space-y-4">
            <div>
              <label for="newPassword" class="block text-sm font-medium text-text-secondary">{{
                'forgot_password.new_password_label' | t
              }}</label>
              <input
                id="newPassword"
                type="password"
                formControlName="newPassword"
                required
                minlength="8"
                class="mt-1 block w-full rounded-md border border-border bg-input text-text-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            @if (resetError(); as error) {
              <p class="text-error text-sm">{{ error }}</p>
            }
            @if (resetSuccess()) {
              <p class="text-success text-sm">{{ 'forgot_password.reset_success' | t }}</p>
            }

            <button
              type="submit"
              [disabled]="resetForm.invalid || isResetting()"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
            >
              {{ (isResetting() ? 'forgot_password.resetting' : 'forgot_password.reset_button') | t }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly tokenQuery = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('token'))),
  );

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly resetForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  isSending = signal(false);
  sendError = signal<string | null>(null);
  sendSuccess = signal(false);

  isResetting = signal(false);
  resetError = signal<string | null>(null);
  resetSuccess = signal(false);

  async sendResetRequest(): Promise<void> {
    if (this.emailForm.invalid) return;
    this.isSending.set(true);
    this.sendError.set(null);
    this.sendSuccess.set(false);

    const email = this.emailForm.controls.email.value;

    try {
      await this.authService.requestPasswordReset(email);
      this.sendSuccess.set(true);
    } catch {
      this.sendError.set('Failed to send reset request');
    } finally {
      this.isSending.set(false);
    }
  }

  async doPasswordReset(): Promise<void> {
    if (this.resetForm.invalid) return;

    const token = this.tokenQuery();
    if (!token) return;

    this.isResetting.set(true);
    this.resetError.set(null);
    this.resetSuccess.set(false);

    const newPassword = this.resetForm.controls.newPassword.value;

    try {
      await this.authService.resetPassword(token, newPassword);
      this.resetSuccess.set(true);
      setTimeout(() => this.router.navigate(['/home']), 1500);
    } catch {
      this.resetError.set('Failed to reset password');
    } finally {
      this.isResetting.set(false);
    }
  }
}
