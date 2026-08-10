import { Component, inject, signal, input, output } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { GlobalErrorHandler } from '../../services/error-handler.service';

export interface DiscoveryMapErrorContext {
  component: string;
  filtersApplied?: string;
  partnerCount?: number;
  offlineMode?: boolean;
}

@Component({
  selector: 'app-discovery-map-error-boundary',
  imports: [TranslatePipe],
  template: `
    @if (!hasError()) {
      <ng-content />
    } @else {
      <section
        class="min-h-[300px] flex flex-col items-center justify-center p-8"
        role="alert"
        aria-live="assertive"
      >
        <div class="text-center max-w-md space-y-5">
          <p class="text-5xl" aria-hidden="true">🗺️</p>
          <h2 class="text-xl font-black text-text-primary">
            {{ 'discoveryMapErrorBoundary.title' | t }}
          </h2>
          <p class="text-sm text-text-secondary">
            {{ 'discoveryMapErrorBoundary.description' | t }}
          </p>
          @if (errorSummary()) {
            <p class="rounded-app bg-surface-200 p-3 text-xs font-mono text-rose-300 break-all">
              {{ errorSummary() }}
            </p>
          }
          <div class="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              (click)="resetError()"
              class="rounded-app bg-accent-500 hover:bg-accent-600 text-white font-bold py-2 px-6 text-sm transition-colors"
              [attr.aria-label]="'discoveryMapErrorBoundary.retryAria' | t"
            >
              {{ 'discoveryMapErrorBoundary.retry' | t }}
            </button>
            @if (showReport()) {
              <button
                type="button"
                (click)="reportCrash()"
                class="rounded-app border border-surface-100 px-4 py-2 text-sm font-bold text-text-secondary hover:bg-surface-200 transition-colors"
                [attr.aria-label]="'discoveryMapErrorBoundary.reportAria' | t"
              >
                {{ 'discoveryMapErrorBoundary.report' | t }}
              </button>
            }
          </div>
          @if (reportedMessage()) {
            <p class="text-xs text-emerald-400 font-bold">
              {{ 'discoveryMapErrorBoundary.reportedMessage' | t }}
            </p>
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class DiscoveryMapErrorBoundaryComponent {
  private errorHandler = inject(GlobalErrorHandler);

  readonly context = input<DiscoveryMapErrorContext>({ component: 'discovery-map' });
  readonly showReport = input(true);
  readonly retry = output<void>();

  readonly hasError = signal(false);
  readonly errorSummary = signal('');
  readonly reportedMessage = signal(false);
  readonly errorCount = signal(0);

  captureError(error: Error, message?: string): void {
    this.hasError.set(true);
    this.errorCount.update((c) => c + 1);
    this.errorSummary.set(message || error.message || 'Unknown discovery map error');

    const enrichedError = new Error(
      `[DiscoveryMap:${this.context().component}] ${this.errorSummary()}`,
    );
    enrichedError.name = 'DiscoveryMapError';
    if (error.stack) {
      enrichedError.stack = error.stack;
    }

    this.errorHandler.handleError(enrichedError);
  }

  resetError(): void {
    this.hasError.set(false);
    this.errorSummary.set('');
    this.reportedMessage.set(false);
    this.errorCount.set(0);
    this.retry.emit();
  }

  reportCrash(): void {
    this.reportedMessage.set(true);

    const enrichedError = new Error(
      `[DiscoveryMap:${this.context().component}] Manual report: ${this.errorSummary()}`,
    );
    enrichedError.name = 'DiscoveryMapManualReport';

    this.errorHandler.handleError(enrichedError);
  }
}
