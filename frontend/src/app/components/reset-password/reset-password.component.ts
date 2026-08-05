import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="min-h-screen flex items-center justify-center p-4 bg-[#121212]">
      <div class="w-full max-w-md bg-surface text-slate-100 rounded-2xl p-6 shadow-xl">
        <h1 class="text-2xl font-bold mb-6">{{ 'auth.resetPassword.title' | t }}</h1>
        <form (ngSubmit)="onSubmit()" #resetForm="ngForm">
          <label class="block mb-1 text-sm" for="token">{{ 'auth.resetPassword.token' | t }}</label>
          <input
            id="token"
            name="token"
            [ngModel]="token()"
            (ngModelChange)="token.set($event)"
            required
            class="w-full p-3 mb-4 bg-white/10 border border-white/20 rounded-lg"
          />
          <label class="block mb-1 text-sm" for="newPassword">{{ 'auth.resetPassword.newPassword' | t }}</label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            [ngModel]="newPassword()"
            (ngModelChange)="newPassword.set($event)"
            required
            minlength="8"
            class="w-full p-3 mb-4 bg-white/10 border border-white/20 rounded-lg"
          />
          <button
            type="submit"
            [disabled]="resetForm.invalid || submitting()"
            class="w-full py-3 bg-primary hover:bg-primary-dark rounded-lg text-white font-semibold transition-colors"
          >
            {{ (submitting() ? 'common.pleaseWait' : 'common.submit') | t }}
          </button>
        </form>
        @if (messageKey()) {
          <p class="mt-4 text-sm text-center" [class.text-green-400]="!isError()" [class.text-red-400]="isError()">
            {{ (messageKey() ?? '') | t }}
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
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly token = signal('');
  readonly newPassword = signal('');
  readonly submitting = signal(false);
  readonly messageKey = signal<string>('');
  readonly isError = signal(false);

  // Read token from query params on init
  private readonly routeToken = this.route.snapshot.queryParamMap.get('token');

  constructor() {
    if (this.routeToken) {
      this.token.set(this.routeToken);
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.token() || !this.newPassword()) return;
    this.submitting.set(true);
    this.isError.set(false);
    try {
      await this.authService.resetPassword(this.token(), this.newPassword());
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
