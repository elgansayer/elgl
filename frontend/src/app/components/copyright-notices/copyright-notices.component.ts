import { DatePipe } from '@angular/common';
import { Component, inject, resource, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInputImports } from '@spartan-ng/helm/input';
import {
  classifyDmcaFailure,
  DmcaService,
  OwnerNotice,
} from '../../services/dmca.service';
import { TranslatePipe } from '../../services/translate.pipe';

/** Where an account holder sees notices about their content and answers them. */
@Component({
  selector: 'app-copyright-notices',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslatePipe,
    HlmCheckbox,
    ...HlmButtonImports,
    ...HlmInputImports,
  ],
  template: `
    <main class="min-h-screen bg-surface-500 px-4 py-8" data-testid="copyright-notices-page">
      <section class="mx-auto w-full max-w-2xl space-y-6" aria-labelledby="copyright-title">
        <header class="space-y-2">
          <h1 id="copyright-title" class="text-2xl font-bold text-text-primary">
            {{ 'dmca.owner.title' | t }}
          </h1>
          <p class="text-sm text-text-secondary">{{ 'dmca.owner.intro' | t }}</p>
        </header>

        @if (notices.isLoading()) {
          <p class="text-sm text-text-secondary" role="status" data-testid="copyright-loading">
            {{ 'dmca.owner.loading' | t }}
          </p>
        } @else if (notices.error()) {
          <div
            class="space-y-3 rounded-card border border-danger/30 bg-danger/10 p-4"
            role="alert"
            data-testid="copyright-error"
          >
            <p class="text-sm text-danger-ink">{{ 'dmca.owner.error' | t }}</p>
            <button hlmBtn type="button" size="touch" (click)="notices.reload()">
              {{ 'dmca.owner.retry' | t }}
            </button>
          </div>
        } @else if (notices.hasValue() && notices.value().length === 0) {
          <p
            class="rounded-2xl border border-surface-200 bg-surface-100 p-5 text-sm text-text-secondary"
            data-testid="copyright-empty"
          >
            {{ 'dmca.owner.empty' | t }}
          </p>
        } @else if (notices.hasValue()) {
          <ul class="space-y-4">
            @for (notice of notices.value(); track notice.id) {
              <li
                class="space-y-3 rounded-2xl border border-surface-200 bg-surface-100 p-5"
                [attr.data-testid]="'copyright-notice-' + notice.reference"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <h2 class="text-base font-semibold text-text-primary">{{ notice.reference }}</h2>
                  <span class="rounded-full bg-surface-300 px-3 py-1 text-xs text-text-secondary">
                    {{ ('dmca.status.' + notice.status) | t }}
                  </span>
                </div>
                <dl class="space-y-1 text-sm text-text-secondary">
                  <div>
                    <dt class="inline font-medium text-text-primary">
                      {{ 'dmca.owner.claimant' | t }}:
                    </dt>
                    <dd class="inline" dir="auto">
                      {{ notice.claimantName }}
                      @if (notice.claimantOrganisation) {
                        ({{ notice.claimantOrganisation }})
                      }
                    </dd>
                  </div>
                  <div>
                    <dt class="inline font-medium text-text-primary">
                      {{ 'dmca.owner.work' | t }}:
                    </dt>
                    <dd class="inline" dir="auto">{{ notice.copyrightedWork }}</dd>
                  </div>
                  @if (notice.contentDisabledAt) {
                    <div>
                      <dt class="inline font-medium text-text-primary">
                        {{ 'dmca.owner.disabledOn' | t }}:
                      </dt>
                      <dd class="inline">{{ notice.contentDisabledAt | date: 'mediumDate' }}</dd>
                    </div>
                  }
                  @if (notice.restoreAfter) {
                    <div>
                      <dt class="inline font-medium text-text-primary">
                        {{ 'dmca.owner.restoreOn' | t }}:
                      </dt>
                      <dd class="inline">{{ notice.restoreAfter | date: 'mediumDate' }}</dd>
                    </div>
                  }
                </dl>

                @if (notice.canCounterNotice) {
                  @if (openId() === notice.id) {
                    <form
                      [formGroup]="form"
                      (ngSubmit)="submit(notice)"
                      class="space-y-3"
                      novalidate
                      [attr.aria-label]="'dmca.owner.counterTitle' | t"
                    >
                      <p class="text-sm text-text-secondary">{{ 'dmca.owner.counterIntro' | t }}</p>
                      <div>
                        <label
                          [for]="'cn-name-' + notice.id"
                          class="block text-sm font-medium text-text-secondary"
                        >
                          {{ 'dmca.owner.fullName' | t }}
                        </label>
                        <input
                          hlmInput
                          [id]="'cn-name-' + notice.id"
                          type="text"
                          autocomplete="name"
                          formControlName="fullName"
                          class="mt-1"
                        />
                      </div>
                      <div>
                        <label
                          [for]="'cn-address-' + notice.id"
                          class="block text-sm font-medium text-text-secondary"
                        >
                          {{ 'dmca.owner.address' | t }}
                        </label>
                        <input
                          hlmInput
                          [id]="'cn-address-' + notice.id"
                          type="text"
                          autocomplete="street-address"
                          formControlName="address"
                          class="mt-1"
                        />
                      </div>
                      <div>
                        <label
                          [for]="'cn-phone-' + notice.id"
                          class="block text-sm font-medium text-text-secondary"
                        >
                          {{ 'dmca.owner.phone' | t }}
                        </label>
                        <input
                          hlmInput
                          [id]="'cn-phone-' + notice.id"
                          type="tel"
                          autocomplete="tel"
                          formControlName="phone"
                          class="mt-1"
                        />
                      </div>
                      <div class="flex items-start gap-3">
                        <hlm-checkbox
                          [inputId]="'cn-good-faith-' + notice.id"
                          formControlName="goodFaithStatement"
                        />
                        <label
                          [for]="'cn-good-faith-' + notice.id"
                          class="text-sm text-text-secondary"
                        >
                          {{ 'dmca.owner.goodFaith' | t }}
                        </label>
                      </div>
                      <div class="flex items-start gap-3">
                        <hlm-checkbox
                          [inputId]="'cn-jurisdiction-' + notice.id"
                          formControlName="jurisdictionConsent"
                        />
                        <label
                          [for]="'cn-jurisdiction-' + notice.id"
                          class="text-sm text-text-secondary"
                        >
                          {{ 'dmca.owner.jurisdiction' | t }}
                        </label>
                      </div>
                      <div>
                        <label
                          [for]="'cn-signature-' + notice.id"
                          class="block text-sm font-medium text-text-secondary"
                        >
                          {{ 'dmca.owner.signature' | t }}
                        </label>
                        <input
                          hlmInput
                          [id]="'cn-signature-' + notice.id"
                          type="text"
                          formControlName="electronicSignature"
                          class="mt-1"
                        />
                      </div>

                      @if (errorKey(); as key) {
                        <p
                          class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger-ink"
                          role="alert"
                          data-testid="counter-notice-error"
                        >
                          {{ key | t }}
                        </p>
                      }

                      <div class="flex gap-3">
                        <button
                          hlmBtn
                          type="submit"
                          size="touch"
                          [disabled]="submitting()"
                          data-testid="counter-notice-submit"
                        >
                          {{ (submitting() ? 'dmca.owner.submitting' : 'dmca.owner.submit') | t }}
                        </button>
                        <button
                          hlmBtn
                          type="button"
                          variant="outline"
                          size="touch"
                          (click)="close()"
                        >
                          {{ 'dmca.owner.cancel' | t }}
                        </button>
                      </div>
                    </form>
                  } @else {
                    <button
                      hlmBtn
                      type="button"
                      size="touch"
                      (click)="open(notice)"
                      data-testid="counter-notice-open"
                    >
                      {{ 'dmca.owner.counterToggle' | t }}
                    </button>
                  }
                }
              </li>
            }
          </ul>
        }

        @if (sentReference(); as reference) {
          <p
            class="rounded-card border border-success/30 bg-success/10 p-3 text-sm text-success"
            role="status"
            data-testid="counter-notice-success"
          >
            {{ 'dmca.owner.success' | t: { reference: reference } }}
          </p>
        }
      </section>
    </main>
  `,
})
export class CopyrightNoticesComponent {
  private readonly dmca = inject(DmcaService);
  private readonly formBuilder = inject(FormBuilder);

  readonly notices = resource({ loader: () => this.dmca.listMine() });
  readonly openId = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly sentReference = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
    phone: ['', Validators.maxLength(40)],
    goodFaithStatement: [false, Validators.requiredTrue],
    jurisdictionConsent: [false, Validators.requiredTrue],
    electronicSignature: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
  });

  open(notice: OwnerNotice): void {
    this.form.reset();
    this.errorKey.set(null);
    this.sentReference.set(null);
    this.openId.set(notice.id);
  }

  close(): void {
    this.openId.set(null);
    this.errorKey.set(null);
  }

  async submit(notice: OwnerNotice): Promise<void> {
    if (this.submitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorKey.set('dmca.owner.required');
      return;
    }

    const value = this.form.getRawValue();
    const phone = value.phone.trim();
    this.submitting.set(true);
    this.errorKey.set(null);
    try {
      await this.dmca.fileCounterNotice(notice.id, {
        fullName: value.fullName.trim(),
        address: value.address.trim(),
        phone: phone === '' ? undefined : phone,
        goodFaithStatement: value.goodFaithStatement,
        jurisdictionConsent: value.jurisdictionConsent,
        electronicSignature: value.electronicSignature.trim(),
      });
      this.sentReference.set(notice.reference);
      this.openId.set(null);
      this.notices.reload();
    } catch (error) {
      const failure = classifyDmcaFailure(error);
      this.errorKey.set(
        failure === 'conflict' || failure === 'not_found'
          ? 'dmca.owner.unavailable'
          : failure === 'invalid'
            ? 'dmca.owner.required'
            : 'dmca.owner.error',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
