import { Component, inject, signal, input, output } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
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
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    @if (!hasError()) {
      <ng-content />
    } @else {
      <section class="flex min-h-[300px] flex-col items-center justify-center p-8" role="alert" aria-live="assertive">
        <div class="max-w-md space-y-5 text-center">
          <p class="text-5xl" aria-hidden="true">🗺️</p>
          <h2 class="text-xl font-black text-text-primary">{{ 'discoveryMapErrorBoundary.title' | t }}</h2>
          <p class="text-sm text-text-secondary">{{ 'discoveryMapErrorBoundary.description' | t }}</p>
          @if (errorSummary()) {
            <p class="break-all rounded-app bg-surface-200 p-3 font-mono text-xs text-danger">{{ errorSummary() }}</p>
          }
          <div class="flex flex-wrap justify-center gap-3">
            <button hlmBtn type="button" size="touch" (click)="resetError()" [attr.aria-label]="'discoveryMapErrorBoundary.retryAria' | t">
              {{ 'discoveryMapErrorBoundary.retry' | t }}
            </button>
            @if (showReport()) {
              <button hlmBtn type="button" variant="secondary" size="touch" (click)="reportCrash()" [attr.aria-label]="'discoveryMapErrorBoundary.reportAria' | t">
                {{ 'discoveryMapErrorBoundary.report' | t }}
              </button>
            }
          </div>
          @if (reportedMessage()) {
            <p class="text-xs font-bold text-success">{{ 'discoveryMapErrorBoundary.reportedMessage' | t }}</p>
          }
        </div>
      </section>
    }
  `,
  styles: [`:host { display: block; }`],
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
    this.errorCount.update((count) => count + 1);
    this.errorSummary.set(message || error.message || 'Unknown discovery map error');
    const enrichedError = new Error(`[DiscoveryMap:${this.context().component}] ${this.errorSummary()}`);
    enrichedError.name = 'DiscoveryMapError';
    if (error.stack) enrichedError.stack = error.stack;
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
    const enrichedError = new Error(`[DiscoveryMap:${this.context().component}] Manual report: ${this.errorSummary()}`);
    enrichedError.name = 'DiscoveryMapManualReport';
    this.errorHandler.handleError(enrichedError);
  }
}
