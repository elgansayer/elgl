import { Component, input, output, signal, inject, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ReadingEngineErrorHandlerService } from '../../services/reading-engine-error-handler.service';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

@Component({
  selector: 'app-reading-engine-error-boundary',
  standalone: true,
  imports: [TranslatePipe, AppButtonPrimaryComponent],
  template: `
    @if (!hasError()) {
      <ng-content />
    } @else {
      <div class="reading-engine-error-fallback space-y-4 pt-8 pb-16" role="alert">
        <section
          class="rounded-sheet border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-4"
        >
          <p class="text-4xl" aria-hidden="true">&#128214;</p>
          <h3 class="text-lg font-black text-rose-400">
            {{ 'readingEngine.errorBoundary.title' | t }}
          </h3>
          <p class="text-sm text-text-secondary">
            {{ 'readingEngine.errorBoundary.description' | t }}
          </p>
          @if (errorSummary()) {
            <p class="rounded-app bg-surface-200 p-3 text-xs font-mono text-rose-300 break-all">
              {{ errorSummary() }}
            </p>
          }
          @if (errorDetailHint()) {
            <p class="rounded-app bg-surface-200 p-2 text-[11px] text-text-muted">
              {{ errorDetailHint() }}
            </p>
          }
          <div class="flex flex-wrap justify-center gap-3">
            <app-button-primary (clicked)="resetError()" customClass="text-xs">
              {{ 'readingEngine.errorBoundary.retryBtn' | t }}
            </app-button-primary>
            @if (showReportButton()) {
              <button
                type="button"
                (click)="reportCrash()"
                class="rounded-app border border-surface-100 ps-4 pe-4 pt-2.5 pb-2.5 text-xs font-bold text-text-secondary hover:bg-surface-200"
              >
                {{ 'readingEngine.errorBoundary.reportBtn' | t }}
              </button>
            }
          </div>
          @if (reportedMessage()) {
            <p class="text-xs text-emerald-400 font-bold">
              {{ 'readingEngine.errorBoundary.reportedMessage' | t }}
            </p>
          }
        </section>
      </div>
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
export class ReadingEngineErrorBoundaryComponent {
  private errorHandler = inject(ReadingEngineErrorHandlerService);

  readonly showReportButton = input(true);
  readonly retry = output<void>();

  readonly hasError = signal(false);
  readonly errorSummary = signal('');
  readonly reportedMessage = signal(false);
  readonly errorCount = signal(0);
  private lastError: Error | null = null;

  readonly errorDetailHint = computed(() => {
    if (this.errorCount() <= 1) return '';
    return `Error count: ${this.errorCount()}. The component has encountered multiple errors.`;
  });

  /**
   * Captures a thrown error and displays the fallback UI.
   */
  captureError(error: Error, extraMetadata?: Record<string, unknown>): void {
    this.lastError = error;
    this.hasError.set(true);
    this.errorCount.update((c) => c + 1);
    this.errorSummary.set(error.message || 'Unknown rendering error');

    this.errorHandler.reportReadingEngineCrash(error, {
      renderingError: true,
      componentStack: error.stack,
      ...extraMetadata,
    });
  }

  resetError(): void {
    this.hasError.set(false);
    this.errorSummary.set('');
    this.reportedMessage.set(false);
    this.errorCount.set(0);
    this.lastError = null;
    this.retry.emit();
  }

  reportCrash(): void {
    this.reportedMessage.set(true);
    if (this.lastError) {
      this.errorHandler.reportReadingEngineCrash(this.lastError, {
        renderingError: true,
        action: 'manual-report',
      });
    }
  }
}
