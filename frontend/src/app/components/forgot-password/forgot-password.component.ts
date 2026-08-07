import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, RouterLink],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-surface p-4">
      <div class="max-w-md w-full space-y-6">
        <h1 class="text-3xl font-bold text-center text-text-primary">
          {{ 'forgot_password.title' | t }}
        </h1>

        @if (!tokenQuery()) {
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

            @if (sendError()) {
              <p class="text-error text-sm">{{ sendError() }}</p>
            }
            @if (sendSuccess()) {
              <p class="text-success text-sm">{{ 'forgot_password.sent_message' | t }}</p>
            }

            <button
              type="submit"
              [disabled]="emailForm.invalid || isSending()"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
            >
              {{ (isSending() ? 'forgot_password.sending' : 'forgot_password.send_button') | t }}
            </button>
          </form>
        } @else {
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

            @if (resetError()) {
              <p class="text-error text-sm">{{ resetError() }}</p>
            }
            @if (resetSuccess()) {
              <p class="text-success text-sm">{{ 'forgot_password.reset_success' | t }}</p>
            }

            <button
              type="submit"
              [disabled]="resetForm.invalid || isResetting()"
              class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-white bg-accent hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
            >
              {{
                (isResetting() ? 'forgot_password.resetting' : 'forgot_password.reset_button') | t
              }}
            </button>
          </form>
        }

        <div class="text-center">
          <a routerLink="/home" class="text-sm text-text-secondary hover:underline">{{
            'forgot_password.back_to_home' | t
          }}</a>
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
  private i18n = inject(I18nService);

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

    try {
      await this.authService.requestPasswordReset(this.emailForm.controls.email.value);
      this.sendSuccess.set(true);
    } catch {
      this.sendError.set(this.i18n.translate('forgot_password.send_error'));
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

    try {
      await this.authService.resetPassword(token, this.resetForm.controls.newPassword.value);
      this.resetSuccess.set(true);
      await this.router.navigate(['/home']);
    } catch {
      this.resetError.set(this.i18n.translate('forgot_password.reset_error'));
    } finally {
      this.isResetting.set(false);
    }
  }
}
