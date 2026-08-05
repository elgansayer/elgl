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
    <div class="min-h-screen flex items-center justify-center bg-[#121212] p-4">
      <div class="max-w-md w-full space-y-6">
        <h1 class="text-2xl font-bold text-center text-white">{{ 'forgot_password.title' | t }}</h1>

        @if (!tokenQuery()) {
          <!-- Email form -->
          <form [formGroup]="emailForm" (ngSubmit)="sendResetRequest()" class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-slate-300">{{
                'forgot_password.email_label' | t
              }}</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                required
                autocomplete="email"
                class="mt-1 block w-full rounded-lg border border-white/20 bg-white/10 text-white px-3 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            @if (sendError(); as error) {
              <p class="text-red-400 text-sm">{{ error }}</p>
            }
            @if (sendSuccess()) {
              <p class="text-green-400 text-sm">{{ 'forgot_password.sent_message' | t }}</p>
            }

            <button
              type="submit"
              [disabled]="emailForm.invalid || isSending()"
              class="w-full flex justify-center py-3 px-4 rounded-full bg-accent hover:bg-accent-dark text-white font-semibold disabled:opacity-50 transition-colors"
            >
              {{ (isSending() ? 'forgot_password.sending' : 'forgot_password.send_button') | t }}
            </button>

            <div class="text-center">
              <a routerLink="/home" class="text-sm text-slate-400 hover:text-white transition-colors">
                {{ 'common.back' | t }}
              </a>
            </div>
          </form>
        } @else {
          <!-- Password reset form -->
          <form [formGroup]="resetForm" (ngSubmit)="doPasswordReset()" class="space-y-4">
            <div>
              <label for="newPassword" class="block text-sm font-medium text-slate-300">{{
                'forgot_password.new_password_label' | t
              }}</label>
              <input
                id="newPassword"
                type="password"
                formControlName="newPassword"
                required
                minlength="8"
                autocomplete="new-password"
                class="mt-1 block w-full rounded-lg border border-white/20 bg-white/10 text-white px-3 py-3 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            @if (resetError(); as error) {
              <p class="text-red-400 text-sm">{{ error }}</p>
            }
            @if (resetSuccess()) {
              <p class="text-green-400 text-sm">{{ 'forgot_password.reset_success' | t }}</p>
            }

            <button
              type="submit"
              [disabled]="resetForm.invalid || isResetting()"
              class="w-full flex justify-center py-3 px-4 rounded-full bg-accent hover:bg-accent-dark text-white font-semibold disabled:opacity-50 transition-colors"
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private i18n = inject(I18nService);
  private authService = inject(AuthService);

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
      this.isSending.set(false);
      this.sendSuccess.set(true);
    } catch {
      this.isSending.set(false);
      this.sendError.set(
        this.i18n.translate('forgot_password.send_error'),
      );
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
      this.isResetting.set(false);
      this.resetSuccess.set(true);
      await this.router.navigate(['/home']);
    } catch {
      this.isResetting.set(false);
      this.resetError.set(
        this.i18n.translate('forgot_password.reset_error'),
      );
    }
  }
}
