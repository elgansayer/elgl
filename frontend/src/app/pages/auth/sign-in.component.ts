import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  SocialLoginButtonsComponent,
  SocialLoginProvider,
} from '../../components/social-login-buttons/social-login-buttons.component';

const DEFAULT_RETURN_URL = '/learn/ai-chat';

@Component({
  selector: 'app-sign-in',
  imports: [
    FormsModule,
    RouterLink,
    HlmButton,
    HlmInput,
    TranslatePipe,
    SocialLoginButtonsComponent,
  ],
  template: `
    <main class="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <header class="space-y-2">
        <h1 class="text-2xl font-bold text-text-primary">
          {{ 'auth.signIn.title' | t }}
        </h1>
        <p class="text-sm text-text-secondary">{{ 'auth.signIn.subtitle' | t }}</p>
      </header>

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
            autocomplete="current-password"
            required
            class="w-full"
            [ngModel]="password()"
            (ngModelChange)="password.set($event)"
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
          {{ (submitting() ? 'auth.signIn.submitting' : 'auth.signIn.submit') | t }}
        </button>
      </form>

      <p class="text-center text-sm text-text-secondary">{{ 'auth.signIn.or' | t }}</p>

      <app-social-login-buttons (loginProvider)="social($event)" />

      <a routerLink="/forgot-password" class="text-center text-sm text-primary-ink">
        {{ 'auth.forgotPassword' | t }}
      </a>

      <p class="text-center text-sm text-text-secondary">
        {{ 'auth.signIn.noAccount' | t }}
        <a routerLink="/register" class="text-primary-ink">
          {{ 'auth.signIn.createAccount' | t }}
        </a>
      </p>
    </main>
  `,
})
export class SignInComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.submitting()) return;

    const email = this.email().trim();
    if (!email || !this.password()) {
      this.errorKey.set('auth.signIn.missingCredentials');
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    try {
      const { error } = await this.auth.signInWithEmail(
        email,
        this.password(),
      );
      if (error) {
        this.errorKey.set('auth.signIn.invalidCredentials');
        return;
      }
      await this.router.navigateByUrl(this.returnUrl());
    } catch {
      this.errorKey.set('auth.signIn.invalidCredentials');
    } finally {
      this.submitting.set(false);
    }
  }

  async social(provider: SocialLoginProvider): Promise<void> {
    this.errorKey.set(null);
    const { error } =
      provider === 'google'
        ? await this.auth.signInWithGoogle()
        : await this.auth.signInWithApple();
    if (error) {
      this.errorKey.set('auth.signIn.socialFailed');
    }
  }

  private returnUrl(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!requested || !requested.startsWith('/') || requested.startsWith('//')) {
      return DEFAULT_RETURN_URL;
    }
    return requested;
  }
}
