import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-change-password',
  imports: [FormsModule, RouterLink, TranslatePipe, ...HlmButtonImports, ...HlmInputImports],
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-500 p-4">
      <div class="w-full max-w-md rounded-2xl bg-surface p-6 text-text-primary shadow-xl">
        <h1 class="mb-6 text-2xl font-bold">{{ 'auth.changePassword.title' | t }}</h1>
        <form (ngSubmit)="onSubmit()" #changeForm="ngForm" class="space-y-4">
          <div>
            <label class="mb-1 block text-sm" for="currentPassword">{{ 'auth.changePassword.currentPassword' | t }}</label>
            <input
              hlmInput
              id="currentPassword"
              name="currentPassword"
              type="password"
              [ngModel]="currentPassword()"
              (ngModelChange)="currentPassword.set($event)"
              required
            />
          </div>
          <div>
            <label class="mb-1 block text-sm" for="newPassword">{{ 'auth.changePassword.newPassword' | t }}</label>
            <input
              hlmInput
              id="newPassword"
              name="newPassword"
              type="password"
              [ngModel]="newPassword()"
              (ngModelChange)="newPassword.set($event)"
              required
              minlength="8"
            />
          </div>
          <button hlmBtn type="submit" size="touch" class="w-full" [disabled]="changeForm.invalid || submitting()">
            {{ (submitting() ? 'common.pleaseWait' : 'common.submit') | t }}
          </button>
        </form>
        @if (messageKey()) {
          <p class="mt-4 text-center text-sm" [class.text-success]="!isError()" [class.text-danger]="isError()">
            {{ messageKey() ?? '' | t }}
          </p>
        }
        <div class="mt-4 text-center">
          <a hlmBtn variant="link" routerLink="/settings">{{ 'auth.changePassword.backToSettings' | t }}</a>
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
