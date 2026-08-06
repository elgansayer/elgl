import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="min-h-screen flex items-center justify-center p-4 bg-[#121212]">
      <div class="w-full max-w-md bg-surface text-slate-100 rounded-2xl p-6 shadow-xl">
        <h1 class="text-2xl font-bold mb-6">{{ 'auth.resetPassword.title' | t }}</h1>
        <form [formGroup]="resetForm" (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label class="block mb-1 text-sm" for="newPassword">{{ 'auth.resetPassword.newPassword' | t }}</label>
            <input
              id="newPassword"
              type="password"
              formControlName="newPassword"
              class="w-full p-3 bg-white/10 border border-white/20 rounded-lg"
            />
          </div>
          <button
            type="submit"
            [disabled]="resetForm.invalid || submitting()"
            class="w-full py-3 bg-primary hover:bg-primary-dark rounded-lg text-white font-semibold transition-colors"
          >
            {{ (submitting() ? 'common.pleaseWait' : 'common.submit') | t }}
          </button>
        </form>
        @if (messageKey(); as msg) {
          <p class="mt-4 text-sm text-center" [class.text-green-400]="!isError()" [class.text-red-400]="isError()">
            {{ msg | t }}
          </p>
        }
        <div class="mt-4 text-center">
          <a routerLink="/home" class="text-sm hover:underline">{{ 'auth.resetPassword.backToHome' | t }}</a>
        </div>
      </div>
    </section>
  `,
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);

  readonly token = signal('');
  readonly submitting = signal(false);
  readonly messageKey = signal<string | null>(null);
  readonly isError = signal(false);

  // Read token from query params on init
  private readonly routeToken = this.route.snapshot.queryParamMap.get('token');

  constructor() {
    if (this.routeToken) {
      this.token.set(this.routeToken);
    }
  }

  constructor() {
    const tokenParam = this.route.snapshot.queryParamMap.get('token');
    if (tokenParam) {
      this.token.set(tokenParam);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.resetForm.invalid || !this.token()) return;
    this.submitting.set(true);
    this.isError.set(false);
    try {
      await this.authService.resetPassword(this.token(), this.resetForm.controls.newPassword.value);
      this.messageKey.set('auth.resetPassword.success');
      this.router.navigate(['/home']);
    } catch {
      this.isError.set(true);
      this.messageKey.set('auth.resetPassword.error');
    } finally {
      this.submitting.set(false);
    }
  }
}
