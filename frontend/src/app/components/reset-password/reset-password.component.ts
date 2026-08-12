import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <section class="min-h-screen flex items-center justify-center p-4 bg-surface-500">
      <div class="w-full max-w-md bg-surface text-text-primary rounded-2xl p-6 shadow-xl">
        <h1 class="text-2xl font-bold mb-6">{{ 'auth.resetPassword.title' | t }}</h1>
        <form [formGroup]="resetForm" (ngSubmit)="onSubmit()" class="space-y-4">
          <div>
            <label class="block mb-1 text-sm" for="newPassword">{{
              'auth.resetPassword.newPassword' | t
            }}</label>
            <input
              id="newPassword"
              type="password"
              formControlName="newPassword"
              class="w-full p-3 bg-surface-300 border border-surface-100 rounded-lg"
            />
          </div>
          <button
            type="submit"
            [disabled]="resetForm.invalid || submitting()"
            class="w-full py-3 bg-primary hover:bg-primary-dark rounded-lg text-on-fill font-semibold transition-colors"
          >
            {{ (submitting() ? 'common.pleaseWait' : 'common.submit') | t }}
          </button>
        </form>
        @if (messageKey(); as msg) {
          <p
            class="mt-4 text-sm text-center"
            [class.text-success]="!isError()"
            [class.text-danger]="isError()"
          >
            {{ msg | t }}
          </p>
        }
        <div class="mt-4 text-center">
          <a routerLink="/home" class="text-sm hover:underline">{{
            'auth.resetPassword.backToHome' | t
          }}</a>
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

  readonly token = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('token') || '')),
    { initialValue: '' },
  );

  readonly resetForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

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
      this.router.navigate(['/home']);
    } catch {
      this.isError.set(true);
      this.messageKey.set('auth.resetPassword.error');
    } finally {
      this.submitting.set(false);
    }
  }
}
