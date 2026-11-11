import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmTextareaImports } from '@spartan-ng/helm/textarea';
import { classifyDmcaFailure, DmcaService } from '../../services/dmca.service';
import { TranslatePipe } from '../../services/translate.pipe';

export const MAX_MATERIAL_REFERENCES = 10;

/** One reference per line; blanks and repeats are dropped. */
export function parseMaterialReferences(text: string): string[] {
  const unique = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed) unique.add(trimmed);
  }
  return [...unique];
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Public form for a notice under the DMCA. Nothing is removed until the email is confirmed. */
@Component({
  selector: 'app-dmca-notice-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    HlmCheckbox,
    ...HlmButtonImports,
    ...HlmInputImports,
    ...HlmTextareaImports,
  ],
  template: `
    <main class="min-h-screen bg-surface-500 px-4 py-8" data-testid="dmca-form-page">
      <section
        class="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-surface-200 bg-surface-100 p-6"
        aria-labelledby="dmca-form-title"
      >
        <header class="space-y-2">
          <h1 id="dmca-form-title" class="text-2xl font-bold text-text-primary">
            {{ 'dmca.form.title' | t }}
          </h1>
          <p class="text-sm text-text-secondary">{{ 'dmca.form.intro' | t }}</p>
          <a routerLink="/legal/dmca" class="text-sm text-primary-ink underline">
            {{ 'dmca.form.policyLink' | t }}
          </a>
        </header>

        @if (references().length > 0) {
          <div
            class="space-y-3 rounded-card border border-success/30 bg-success/10 p-4 text-success"
            role="status"
            data-testid="dmca-form-success"
          >
            <h2 class="text-lg font-semibold">{{ 'dmca.form.successTitle' | t }}</h2>
            <p class="text-sm">{{ 'dmca.form.successMessage' | t }}</p>
            <p class="text-sm font-medium">{{ 'dmca.form.successReferences' | t }}</p>
            <ul class="list-disc ps-5 text-sm">
              @for (reference of references(); track reference) {
                <li>{{ reference }}</li>
              }
            </ul>
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4" novalidate>
            <div>
              <label for="dmca-name" class="block text-sm font-medium text-text-secondary">
                {{ 'dmca.form.nameLabel' | t }}
              </label>
              <input
                hlmInput
                id="dmca-name"
                type="text"
                autocomplete="name"
                formControlName="claimantName"
                class="mt-1"
                [attr.aria-invalid]="invalid('claimantName') ? 'true' : null"
              />
            </div>
            <div>
              <label for="dmca-email" class="block text-sm font-medium text-text-secondary">
                {{ 'dmca.form.emailLabel' | t }}
              </label>
              <input
                hlmInput
                id="dmca-email"
                type="email"
                autocomplete="email"
                formControlName="claimantEmail"
                class="mt-1"
                [attr.aria-invalid]="invalid('claimantEmail') ? 'true' : null"
              />
            </div>
            <div>
              <label for="dmca-organisation" class="block text-sm font-medium text-text-secondary">
                {{ 'dmca.form.organisationLabel' | t }}
              </label>
              <input
                hlmInput
                id="dmca-organisation"
                type="text"
                autocomplete="organization"
                formControlName="claimantOrganisation"
                class="mt-1"
              />
            </div>
            <div>
              <label for="dmca-address" class="block text-sm font-medium text-text-secondary">
                {{ 'dmca.form.addressLabel' | t }}
              </label>
              <input
                hlmInput
                id="dmca-address"
                type="text"
                autocomplete="street-address"
                formControlName="claimantAddress"
                class="mt-1"
              />
            </div>
            <div>
              <label for="dmca-phone" class="block text-sm font-medium text-text-secondary">
                {{ 'dmca.form.phoneLabel' | t }}
              </label>
              <input
                hlmInput
                id="dmca-phone"
                type="tel"
                autocomplete="tel"
                formControlName="claimantPhone"
                class="mt-1"
              />
            </div>
            <div>
              <label for="dmca-work" class="block text-sm font-medium text-text-secondary">
                {{ 'dmca.form.workLabel' | t }}
              </label>
              <textarea
                hlmTextarea
                id="dmca-work"
                rows="4"
                formControlName="copyrightedWork"
                class="mt-1"
                aria-describedby="dmca-work-hint"
                [attr.aria-invalid]="invalid('copyrightedWork') ? 'true' : null"
              ></textarea>
              <p id="dmca-work-hint" class="mt-1 text-xs text-text-muted">
                {{ 'dmca.form.workHint' | t }}
              </p>
            </div>
            <div>
              <label for="dmca-material" class="block text-sm font-medium text-text-secondary">
                {{ 'dmca.form.materialLabel' | t }}
              </label>
              <textarea
                hlmTextarea
                id="dmca-material"
                rows="4"
                formControlName="materialReferences"
                class="mt-1"
                aria-describedby="dmca-material-hint"
                [attr.aria-invalid]="invalid('materialReferences') ? 'true' : null"
              ></textarea>
              <p id="dmca-material-hint" class="mt-1 text-xs text-text-muted">
                {{ 'dmca.form.materialHint' | t }}
              </p>
            </div>

            <div class="flex items-start gap-3">
              <hlm-checkbox inputId="dmca-good-faith" formControlName="goodFaithStatement" />
              <label for="dmca-good-faith" class="text-sm text-text-secondary">
                {{ 'dmca.form.goodFaith' | t }}
              </label>
            </div>
            <div class="flex items-start gap-3">
              <hlm-checkbox inputId="dmca-accuracy" formControlName="accuracyStatement" />
              <label for="dmca-accuracy" class="text-sm text-text-secondary">
                {{ 'dmca.form.accuracy' | t }}
              </label>
            </div>

            <div>
              <label for="dmca-signature" class="block text-sm font-medium text-text-secondary">
                {{ 'dmca.form.signatureLabel' | t }}
              </label>
              <input
                hlmInput
                id="dmca-signature"
                type="text"
                formControlName="electronicSignature"
                class="mt-1"
                [attr.aria-invalid]="invalid('electronicSignature') ? 'true' : null"
              />
            </div>

            <p class="text-xs text-text-muted">{{ 'dmca.form.sharing' | t }}</p>

            @if (errorKey(); as key) {
              <p
                class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger-ink"
                role="alert"
                data-testid="dmca-form-error"
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
              data-testid="dmca-form-submit"
            >
              {{ (submitting() ? 'dmca.form.submitting' : 'dmca.form.submit') | t }}
            </button>
          </form>
        }
      </section>
    </main>
  `,
})
export class DmcaNoticeFormComponent {
  private readonly dmca = inject(DmcaService);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.nonNullable.group({
    claimantName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
    claimantEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    claimantOrganisation: ['', Validators.maxLength(200)],
    claimantAddress: ['', Validators.maxLength(500)],
    claimantPhone: ['', Validators.maxLength(40)],
    copyrightedWork: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    materialReferences: ['', Validators.required],
    goodFaithStatement: [false, Validators.requiredTrue],
    accuracyStatement: [false, Validators.requiredTrue],
    electronicSignature: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
  });

  readonly submitting = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly references = signal<readonly string[]>([]);

  invalid(name: string): boolean {
    const field = this.form.get(name);
    return field !== null && field.invalid && (field.touched || field.dirty);
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;

    const items = parseMaterialReferences(this.form.controls.materialReferences.value);
    if (this.form.invalid || items.length === 0) {
      this.form.markAllAsTouched();
      this.errorKey.set('dmca.form.required');
      return;
    }
    if (items.length > MAX_MATERIAL_REFERENCES) {
      this.errorKey.set('dmca.form.tooManyReferences');
      return;
    }

    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.errorKey.set(null);
    try {
      const result = await this.dmca.submitNotice({
        claimantName: value.claimantName.trim(),
        claimantEmail: value.claimantEmail.trim(),
        claimantOrganisation: optional(value.claimantOrganisation),
        claimantAddress: optional(value.claimantAddress),
        claimantPhone: optional(value.claimantPhone),
        copyrightedWork: value.copyrightedWork.trim(),
        materialReferences: items,
        goodFaithStatement: value.goodFaithStatement,
        accuracyStatement: value.accuracyStatement,
        electronicSignature: value.electronicSignature.trim(),
      });
      this.references.set(result.references);
    } catch (error) {
      const failure = classifyDmcaFailure(error);
      this.errorKey.set(
        failure === 'rate_limited'
          ? 'dmca.form.rateLimited'
          : failure === 'invalid'
            ? 'dmca.form.required'
            : 'dmca.form.error',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
