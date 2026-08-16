import { Component, inject, signal, input } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { EconomyErrorHandlerService } from '../../services/economy-error-handler.service';

@Component({
  selector: 'app-error-boundary',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    @if (hasError()) {
      <div
        class="flex min-h-[300px] flex-col items-center justify-center p-8"
        [class.min-h-screen]="fullPage()"
      >
        <div class="max-w-md text-center">
          <div class="mb-4 text-5xl" aria-hidden="true">🪙</div>
          <h2 class="mb-3 text-xl font-bold text-text-primary">
            {{ 'errorBoundary.title' | t }}
          </h2>
          <p class="mb-6 text-sm text-text-secondary">
            {{ 'errorBoundary.message' | t }}
          </p>
          <p class="mb-6 break-all font-mono text-xs text-text-muted">
            {{ errorSummary() }}
          </p>
          <div class="flex justify-center gap-3">
            @if (showRetry()) {
              <button hlmBtn type="button" size="touch" (click)="resetError()">
                {{ 'errorBoundary.retry' | t }}
              </button>
            }
            <button hlmBtn type="button" variant="secondary" size="touch" (click)="reportCrash()">
              {{ 'errorBoundary.report' | t }}
            </button>
          </div>
        </div>
      </div>
    } @else {
      <ng-content />
    }
  `,
})
export class ErrorBoundaryComponent {
  private economyErrorHandler = inject(EconomyErrorHandlerService);

  readonly fullPage = input<boolean>(false);
  readonly showRetry = input<boolean>(true);
  readonly context = input<string>('economy');

  readonly hasError = signal<boolean>(false);
  readonly errorSummary = signal<string>('');
  private lastError: Error | null = null;

  resetError(): void {
    this.hasError.set(false);
    this.errorSummary.set('');
    this.lastError = null;
  }

  reportCrash(): void {
    if (this.lastError) {
      this.economyErrorHandler.reportEconomyCrash(this.lastError, {
        boundaryContext: this.context(),
      });
    }
  }

  handleBoundaryError(error: Error): void {
    this.lastError = error;
    this.hasError.set(true);
    this.errorSummary.set(error.message || 'Unknown rendering error');

    this.economyErrorHandler.reportEconomyCrash(error, {
      boundaryContext: this.context(),
      renderingError: true,
    });
  }
}
