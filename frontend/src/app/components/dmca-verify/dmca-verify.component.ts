import { Component, computed, inject, input, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { classifyDmcaFailure, DmcaService } from '../../services/dmca.service';
import { TranslatePipe } from '../../services/translate.pipe';

/** Landing page for the confirmation link in the claimant's email. */
@Component({
  selector: 'app-dmca-verify',
  imports: [RouterLink, TranslatePipe, ...HlmButtonImports],
  template: `
    <main
      class="flex min-h-screen items-center justify-center bg-surface-500 p-4"
      data-testid="dmca-verify-page"
    >
      <section
        class="w-full max-w-md space-y-4 rounded-2xl border border-surface-200 bg-surface-100 p-6"
        aria-labelledby="dmca-verify-title"
        [attr.aria-busy]="result.isLoading()"
      >
        <h1 id="dmca-verify-title" class="text-2xl font-bold text-text-primary">
          {{ 'dmca.verify.title' | t }}
        </h1>

        @if (result.isLoading()) {
          <p class="text-sm text-text-secondary" role="status" data-testid="dmca-verify-loading">
            {{ 'dmca.verify.loading' | t }}
          </p>
        } @else if (result.error()) {
          <p
            class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger-ink"
            role="alert"
            data-testid="dmca-verify-error"
          >
            {{ errorKey() | t }}
          </p>
          @if (canRetry()) {
            <button
              hlmBtn
              type="button"
              size="touch"
              (click)="result.reload()"
              data-testid="dmca-verify-retry"
            >
              {{ 'dmca.verify.retry' | t }}
            </button>
          } @else {
            <a hlmBtn variant="link" routerLink="/dmca">{{ 'dmca.verify.submitAgain' | t }}</a>
          }
        } @else if (!token()) {
          <p
            class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger-ink"
            role="alert"
            data-testid="dmca-verify-missing"
          >
            {{ 'dmca.verify.invalid' | t }}
          </p>
        } @else if (result.hasValue()) {
          <div class="space-y-3" role="status" data-testid="dmca-verify-success">
            <h2 class="text-lg font-semibold text-text-primary">
              {{ 'dmca.verify.successTitle' | t }}
            </h2>
            <p class="text-sm text-text-secondary">{{ 'dmca.verify.successMessage' | t }}</p>
            <ul class="space-y-1 text-sm text-text-secondary">
              @for (item of result.value(); track item.reference) {
                <li>
                  <span class="font-medium text-text-primary">{{ item.reference }}</span>
                  <span aria-hidden="true"> - </span>
                  <span>{{ ('dmca.status.' + item.status) | t }}</span>
                </li>
              }
            </ul>
          </div>
        }
      </section>
    </main>
  `,
})
export class DmcaVerifyComponent {
  private readonly dmca = inject(DmcaService);

  /** Bound from the `token` query parameter by the router. */
  readonly token = input<string | undefined>(undefined);

  readonly result = resource({
    params: () => this.token(),
    loader: ({ params }) => this.dmca.verifyNotice(params),
  });

  private readonly failure = computed(() => classifyDmcaFailure(this.result.error()));

  readonly errorKey = computed(() => {
    switch (this.failure()) {
      case 'not_found':
      case 'invalid':
        return 'dmca.verify.invalid';
      case 'gone':
        return 'dmca.verify.expired';
      default:
        return 'dmca.verify.error';
    }
  });

  /** Only a temporary failure is worth retrying with the same link. */
  readonly canRetry = computed(
    () => this.failure() === 'unavailable' || this.failure() === 'rate_limited',
  );
}
