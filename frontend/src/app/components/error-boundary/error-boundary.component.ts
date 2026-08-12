import { Component, inject, signal, input } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { EconomyErrorHandlerService } from '../../services/economy-error-handler.service';

@Component({
  selector: 'app-error-boundary',
  imports: [TranslatePipe],
  template: `
    @if (hasError()) {
      <div
        class="min-h-[300px] flex flex-col items-center justify-center p-8"
        [class.min-h-screen]="fullPage()"
      >
        <div class="text-center max-w-md">
          <div class="text-5xl mb-4">🪙</div>
          <h2 class="text-xl font-bold text-text-primary mb-3">
            {{ 'errorBoundary.title' | t }}
          </h2>
          <p class="text-text-secondary mb-6 text-sm">
            {{ 'errorBoundary.message' | t }}
          </p>
          <p class="text-text-muted text-xs mb-6 font-mono break-all">
            {{ errorSummary() }}
          </p>
          <div class="flex gap-3 justify-center">
            @if (showRetry()) {
              <button
                (click)="resetError()"
                class="bg-primary hover:bg-primary-dark text-on-fill font-semibold py-2 px-6 rounded-xl transition-all duration-200 text-sm"
              >
                {{ 'errorBoundary.retry' | t }}
              </button>
            }
            <button
              (click)="reportCrash()"
              class="bg-surface-100 hover:bg-surface-200 text-text-secondary font-semibold py-2 px-6 rounded-xl transition-all duration-200 text-sm"
            >
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

  /**
   * Called when a child component throws during change detection or rendering.
   */
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
