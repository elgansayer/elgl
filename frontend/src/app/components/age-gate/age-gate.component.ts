import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import {
  AGE_GATE_ERROR_CODES,
  AgeGateService,
  AgeGateView,
  readApiErrorCode,
} from '../../services/age-gate.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';

const EARLIEST_YEAR = 1900;

interface DateParts {
  readonly day: string;
  readonly month: string;
  readonly year: string;
}

/**
 * Turns the three typed parts into an ISO calendar date, or null when they do
 * not describe a real date between 1900 and today (UTC, like the server).
 */
export function toIsoDate(parts: DateParts, now: Date): string | null {
  if (!/^\d{1,2}$/.test(parts.day) || !/^\d{1,2}$/.test(parts.month) || !/^\d{4}$/.test(parts.year)) {
    return null;
  }

  const day = Number(parts.day);
  const month = Number(parts.month);
  const year = Number(parts.year);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    year < EARLIEST_YEAR ||
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day ||
    candidate.getTime() > now.getTime()
  ) {
    return null;
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
}

/**
 * Neutral age screen. It never says which age passes, so it cannot be used to
 * work out the right answer, and it shows the same form to everyone.
 */
@Component({
  selector: 'app-age-gate',
  imports: [ReactiveFormsModule, TranslatePipe, ...HlmButtonImports, ...HlmInputImports],
  template: `
    <main
      class="flex min-h-screen items-center justify-center bg-surface-500 p-4"
      data-testid="age-gate"
    >
      <section
        class="w-full max-w-md space-y-6 rounded-2xl border border-surface-200 bg-surface-100 p-6"
        aria-labelledby="age-gate-title"
        [attr.aria-busy]="status.isLoading() || submitting()"
      >
        @if (status.isLoading()) {
          <p class="text-sm text-text-secondary" role="status" data-testid="age-gate-loading">
            {{ 'ageGate.loading' | t }}
          </p>
        } @else if (status.error() && !current()) {
          <h1 id="age-gate-title" class="text-2xl font-bold text-text-primary">
            {{ 'ageGate.title' | t }}
          </h1>
          <p
            class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger-ink"
            role="alert"
            data-testid="age-gate-load-error"
          >
            {{ 'ageGate.loadError' | t }}
          </p>
          <button
            hlmBtn
            type="button"
            size="touch"
            class="w-full"
            (click)="status.reload()"
            data-testid="age-gate-retry"
          >
            {{ 'ageGate.retry' | t }}
          </button>
        } @else if (isBlocked()) {
          <h1 id="age-gate-title" class="text-2xl font-bold text-text-primary">
            {{ 'ageGate.blockedTitle' | t }}
          </h1>
          <p class="text-sm text-text-secondary" data-testid="age-gate-blocked">
            {{ 'ageGate.blockedMessage' | t }}
          </p>
          <button
            hlmBtn
            type="button"
            size="touch"
            class="w-full"
            (click)="signOut()"
            data-testid="age-gate-sign-out"
          >
            {{ 'ageGate.signOut' | t }}
          </button>
        } @else if (!isAllowed()) {
          <header class="space-y-2">
            <h1 id="age-gate-title" class="text-2xl font-bold text-text-primary">
              {{ 'ageGate.title' | t }}
            </h1>
            <p class="text-sm text-text-secondary">{{ 'ageGate.intro' | t }}</p>
          </header>

          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
            <fieldset class="space-y-2">
              <legend class="text-sm font-medium text-text-secondary">
                {{ 'ageGate.legend' | t }}
              </legend>
              <div class="flex gap-3">
                <div class="flex-1">
                  <label for="age-gate-day" class="block text-xs text-text-secondary">
                    {{ 'ageGate.dayLabel' | t }}
                  </label>
                  <input
                    hlmInput
                    id="age-gate-day"
                    type="text"
                    inputmode="numeric"
                    autocomplete="bday-day"
                    maxlength="2"
                    formControlName="day"
                    class="mt-1"
                    [placeholder]="'ageGate.dayPlaceholder' | t"
                    [attr.aria-invalid]="errorKey() ? 'true' : null"
                    [attr.aria-describedby]="errorKey() ? 'age-gate-error' : null"
                  />
                </div>
                <div class="flex-1">
                  <label for="age-gate-month" class="block text-xs text-text-secondary">
                    {{ 'ageGate.monthLabel' | t }}
                  </label>
                  <input
                    hlmInput
                    id="age-gate-month"
                    type="text"
                    inputmode="numeric"
                    autocomplete="bday-month"
                    maxlength="2"
                    formControlName="month"
                    class="mt-1"
                    [placeholder]="'ageGate.monthPlaceholder' | t"
                    [attr.aria-invalid]="errorKey() ? 'true' : null"
                    [attr.aria-describedby]="errorKey() ? 'age-gate-error' : null"
                  />
                </div>
                <div class="flex-[1.5]">
                  <label for="age-gate-year" class="block text-xs text-text-secondary">
                    {{ 'ageGate.yearLabel' | t }}
                  </label>
                  <input
                    hlmInput
                    id="age-gate-year"
                    type="text"
                    inputmode="numeric"
                    autocomplete="bday-year"
                    maxlength="4"
                    formControlName="year"
                    class="mt-1"
                    [placeholder]="'ageGate.yearPlaceholder' | t"
                    [attr.aria-invalid]="errorKey() ? 'true' : null"
                    [attr.aria-describedby]="errorKey() ? 'age-gate-error' : null"
                  />
                </div>
              </div>
            </fieldset>

            @if (errorKey(); as key) {
              <p
                id="age-gate-error"
                class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger-ink"
                role="alert"
                data-testid="age-gate-error"
              >
                {{ key | t }}
              </p>
            }

            <button
              hlmBtn
              type="submit"
              size="touch"
              class="w-full"
              [disabled]="submitting()"
              data-testid="age-gate-submit"
            >
              {{ (submitting() ? 'ageGate.submitting' : 'ageGate.submit') | t }}
            </button>
          </form>
        }
      </section>
    </main>
  `,
})
export class AgeGateComponent {
  private readonly ageGate = inject(AgeGateService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.nonNullable.group({
    day: ['', [Validators.required, Validators.pattern(/^\d{1,2}$/)]],
    month: ['', [Validators.required, Validators.pattern(/^\d{1,2}$/)]],
    year: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
  });

  readonly status = resource({ loader: () => this.ageGate.loadStatus() });
  readonly decision = signal<AgeGateView | null>(null);
  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);

  /** The decision just made here wins over whatever was loaded earlier. */
  readonly current = computed<AgeGateView | null>(
    () => this.decision() ?? (this.status.hasValue() ? this.status.value() : null),
  );
  readonly isBlocked = computed(() => this.current()?.blocked === true);
  readonly isAllowed = computed(() => {
    const view = this.current();
    return view !== null && !view.required && !view.blocked;
  });

  constructor() {
    // Accounts that are already cleared have nothing to do here.
    effect(() => {
      if (this.isAllowed()) {
        void this.router.navigateByUrl('/');
      }
    });
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;

    const isoDate = toIsoDate(this.form.getRawValue(), new Date());
    if (!isoDate) {
      this.form.markAllAsTouched();
      this.errorKey.set('ageGate.invalidDate');
      return;
    }

    this.submitting.set(true);
    this.errorKey.set(null);
    try {
      const view = await this.ageGate.submit(isoDate);
      this.decision.set(view);
      if (view.blocked) {
        // End the session now; the account is closed and its sign-in disabled.
        await this.authService.signOut();
      }
    } catch (error) {
      this.errorKey.set(
        readApiErrorCode(error) === AGE_GATE_ERROR_CODES.invalidDateOfBirth
          ? 'ageGate.invalidDate'
          : 'ageGate.serverError',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigateByUrl('/home');
  }
}
