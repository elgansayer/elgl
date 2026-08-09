import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-change-password',
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="min-h-screen flex items-center justify-center p-4 bg-[#121212]">
      <div class="w-full max-w-md bg-surface text-slate-100 rounded-2xl p-6 shadow-xl">
        <h1 class="text-2xl font-bold mb-6">{{ 'auth.changePassword.title' | t }}</h1>
        <form (ngSubmit)="onSubmit()" #changeForm="ngForm">
          <label class="block mb-1 text-sm" for="currentPassword">{{ 'auth.changePassword.currentPassword' | t }}</label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            [ngModel]="currentPassword()"
            (ngModelChange)="currentPassword.set($event)"
            required
            class="w-full p-3 mb-4 bg-white/10 border border-white/20 rounded-lg"
          />
          <label class="block mb-1 text-sm" for="newPassword">{{ 'auth.changePassword.newPassword' | t }}</label>
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
            [disabled]="changeForm.invalid || submitting()"
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
          <a routerLink="/settings" class="text-sm hover:underline">{{ 'auth.changePassword.backToSettings' | t }}</a>
        </div>
      </div>
    </section>
  `,
})
export class ChangePasswordComponent {
  private authService = inject(AuthService);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly submitting = signal(false);
  readonly messageKey = signal<string>('');
  readonly isError = signal(false);

  async onSubmit(): Promise<void> {
    if (!this.currentPassword() || !this.newPassword()) return;
    this.submitting.set(true);
    this.isError.set(false);
    try {
      await this.authService.changePassword(this.currentPassword(), this.newPassword());
      this.messageKey.set('auth.changePassword.success');
    } catch {
      this.isError.set(true);
      this.messageKey.set('auth.changePassword.error');
    } finally {
      this.submitting.set(false);
    }
  }
}
