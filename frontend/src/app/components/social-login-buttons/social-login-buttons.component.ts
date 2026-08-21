import { Component, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-social-login-buttons',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div class="flex flex-col gap-3 ps-4 pe-4">
      <button hlmBtn type="button" variant="outline" size="touch" class="w-full rounded-full" (click)="loginWith('google')">
        <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {{ 'auth.login_google' | t }}
      </button>
      <button hlmBtn type="button" variant="outline" size="touch" class="w-full rounded-full" (click)="loginWith('facebook')">
        <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        {{ 'auth.login_facebook' | t }}
      </button>
      <button hlmBtn type="button" variant="outline" size="touch" class="w-full rounded-full" (click)="loginWith('apple')">
        <svg class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.569 12.625c-.026-2.056 1.68-3.06 1.755-3.107-.955-1.4-2.442-1.59-2.972-1.613-1.265-.128-2.47.745-3.113.745-.642 0-1.636-.726-2.689-.707-1.383.02-2.657.804-3.37 2.043-1.436 2.492-.367 6.187 1.032 8.217.683.994 1.497 2.11 2.566 2.071 1.03-.04 1.419-.67 2.666-.67 1.247 0 1.597.67 2.683.65 1.107-.02 1.81-.992 2.471-1.988.78-1.133 1.106-2.232 1.123-2.29-.025-.009-2.158-.829-2.187-3.288zm-1.828-5.406c.564-.683.945-1.633.842-2.578-.813.033-1.803.541-2.382 1.224-.521.61-.977 1.588-.854 2.524.902.07 1.824-.46 2.394-1.17z"/>
        </svg>
        {{ 'auth.login_apple' | t }}
      </button>
    </div>
  `,
})
export class SocialLoginButtonsComponent {
  readonly loginProvider = output<string>();

  loginWith(provider: string): void {
    this.loginProvider.emit(provider);
  }
}
