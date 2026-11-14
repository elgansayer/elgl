import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

const MINIMUM_PASSWORD_LENGTH = 8;

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, HlmButton, HlmInput, TranslatePipe],
  template: `
    <main class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-text-primary">
          {{ 'auth.register.title' | t }}
        </h1>
        <p class="text-sm text-text-secondary">{{ 'auth.register.subtitle' | t }}</p>
      </header>

      @if (submitted()) {
        <p role="status" class="rounded-card bg-success/10 px-3 py-2 text-sm text-text-primary">
          {{ 'auth.register.checkEmail' | t }}
        </p>
      } @else {
        <form class="space-y-4" (ngSubmit)="submit()">
          <label class="block text-sm font-medium text-text-primary">
            <span class="mb-1 block">{{ 'auth.email' | t }}</span>
            <input
              hlmInput
              type="email"
              name="email"
              autocomplete="email"
              required
              class="w-full"
              [ngModel]="email()"
              (ngModelChange)="email.set($event)"
            />
          </label>

          <label class="block text-sm font-medium text-text-primary">
            <span class="mb-1 block">{{ 'auth.password' | t }}</span>
            <input
              hlmInput
              type="password"
              name="password"
              autocomplete="new-password"
              required
              class="w-full"
              [ngModel]="password()"
              (ngModelChange)="password.set($event)"
            />
          </label>

          <label class="block text-sm font-medium text-text-primary">
            <span class="mb-1 block">{{ 'auth.register.confirmPassword' | t }}</span>
            <input
              hlmInput
              type="password"
              name="confirmPassword"
              autocomplete="new-password"
              required
              class="w-full"
              [ngModel]="confirmPassword()"
              (ngModelChange)="confirmPassword.set($event)"
            />
          </label>

          @if (errorKey(); as key) {
            <p role="alert" class="rounded-card bg-danger/10 px-3 py-2 text-sm text-danger-ink">
              {{ key | t }}
            </p>
          }

          <button
            hlmBtn
            type="submit"
            size="touch"
            class="w-full"
            [disabled]="submitting()"
          >
            {{ (submitting() ? 'auth.register.submitting' : 'auth.register.submit') | t }}
          </button>
        </form>
      }

      <p class="text-center text-sm text-text-secondary">
        {{ 'auth.register.haveAccount' | t }}
        <a routerLink="/login" class="text-primary-ink">
          {{ 'auth.register.signIn' | t }}
        </a>
      </p>
    </main>
  `,
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorKey = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.submitting()) return;

    const email = this.email().trim();
    if (!email) {
      this.errorKey.set('auth.signIn.missingCredentials');
      return;
    }
    if (this.password().length < MINIMUM_PASSWORD_LENGTH) {
      this.errorKey.set('auth.register.passwordTooShort');
      return;
    }
    if (this.password() !== this.confirmPassword()) {
      this.errorKey.set('auth.register.passwordMismatch');
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    try {
      const { error } = await this.auth.signUpWithEmail(
        email,
        this.password(),
      );
      if (error) {
        this.errorKey.set('auth.register.error');
        return;
      }
      if (this.auth.isAuthenticated()) {
        await this.router.navigateByUrl('/onboarding');
        return;
      }
      this.submitted.set(true);
    } catch {
      this.errorKey.set('auth.register.error');
    } finally {
      this.submitting.set(false);
    }
  }
}
