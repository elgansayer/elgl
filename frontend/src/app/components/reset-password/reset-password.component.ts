import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, ...HlmButtonImports, ...HlmInputImports],
  template: `
    <section class="flex min-h-screen items-center justify-center bg-surface-500 p-4">
      <div class="w-full max-w-md rounded-2xl bg-surface p-6 text-text-primary shadow-xl">
        <h1 class="mb-6 text-2xl font-bold">{{ 'auth.resetPassword.title' | t }}</h1>
        <form [formGroup]="resetForm" (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label class="mb-1 block text-sm" for="newPassword">{{ 'auth.resetPassword.newPassword' | t }}</label>
            <input hlmInput id="newPassword" type="password" formControlName="newPassword" />
          </div>
          <button hlmBtn type="submit" size="touch" class="w-full" [disabled]="resetForm.invalid || submitting()">
            {{ (submitting() ? 'common.pleaseWait' : 'common.submit') | t }}
          </button>
        </form>
        @if (messageKey(); as msg) {
          <p class="mt-4 text-center text-sm" [class.text-success]="!isError()" [class.text-danger]="isError()">
            {{ msg | t }}
          </p>
        }
        <div class="mt-4 text-center">
          <a hlmBtn variant="link" routerLink="/home">{{ 'auth.resetPassword.backToHome' | t }}</a>
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

  readonly token = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('token') || '')), { initialValue: '' });
  readonly resetForm = this.fb.nonNullable.group({ newPassword: ['', [Validators.required, Validators.minLength(8)]] });
  readonly submitting = signal(false);
  readonly messageKey = signal<string | null>(null);
  readonly isError = signal(false);

  async onSubmit(): Promise<void> {
    if (this.resetForm.invalid || !this.token()) return;
    this.submitting.set(true);
    this.isError.set(false);
    try {
      await this.authService.resetPassword(this.token(), this.resetForm.controls.newPassword.value);
      this.messageKey.set('auth.resetPassword.success');
      await this.router.navigate(['/home']);
    } catch {
      this.isError.set(true);
      this.messageKey.set('auth.resetPassword.error');
    } finally {
      this.submitting.set(false);
    }
  }
}
