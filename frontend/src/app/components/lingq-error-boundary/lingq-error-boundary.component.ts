import { Component, input, output, signal, inject, ErrorHandler } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';

export interface LingqErrorContext {
  component: string;
  operation?: string;
  wordToken?: string;
  language?: string;
  textLength?: number;
}

class LingqContextError extends Error {
  readonly lingqContext: LingqErrorContext;
  constructor(message: string, lingqContext: LingqErrorContext, stack?: string) {
    super(message);
    this.lingqContext = lingqContext;
    if (stack) {
      this.stack = stack;
    }
  }
}

@Component({
  selector: 'app-lingq-error-boundary',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (!hasError()) {
      <ng-content />
    } @else {
      <div class="mx-auto max-w-md space-y-4 pt-8 pb-16">
        <section class="rounded-sheet border border-amber-500/30 bg-amber-500/10 p-6 text-center space-y-4">
          <p class="text-4xl" aria-hidden="true">&#128218;</p>
          <h3 class="text-lg font-black text-amber-400">{{ 'lingqErrorBoundary.title' | t }}</h3>
          <p class="text-sm text-text-secondary">{{ 'lingqErrorBoundary.description' | t }}</p>
          @if (errorMessage()) {
            <p class="rounded-app bg-surface-200 p-3 text-xs font-mono text-amber-300 break-all">
              {{ errorMessage() }}
            </p>
          }
          <div class="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              (click)="resetError()"
              class="app-button-primary ps-4 pe-4 pt-2.5 pb-2.5 text-xs font-bold"
            >
              {{ 'lingqErrorBoundary.retryBtn' | t }}
            </button>
            @if (showReportButton()) {
              <button
                type="button"
                (click)="reportCrash()"
                class="rounded-app border border-surface-100 ps-4 pe-4 pt-2.5 pb-2.5 text-xs font-bold text-text-secondary hover:bg-surface-200"
              >
                {{ 'lingqErrorBoundary.reportBtn' | t }}
              </button>
            }
          </div>
          @if (reportedMessage()) {
            <p class="text-xs text-emerald-400 font-bold">{{ 'lingqErrorBoundary.reportedMessage' | t }}</p>
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
export class LingqErrorBoundaryComponent {
  private errorHandler = inject(ErrorHandler);

  readonly context = input<LingqErrorContext>({ component: 'unknown' });
  readonly showReportButton = input(true);
  readonly retry = output<void>();
  readonly report = output<LingqErrorContext>();

  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly reportedMessage = signal(false);

  captureError(error: Error, message?: string): void {
    this.hasError.set(true);
    this.errorMessage.set(message ?? error.message ?? 'Unknown error in LingQ reading engine');

    const enrichedError = new Error(
      `[LingQ:${this.context().component}] ${this.errorMessage()}`,
    );
    enrichedError.name = 'LingqError';
    if (error.stack) {
      enrichedError.stack = error.stack;
    }

    this.reportErrorInternal(enrichedError);
  }

  resetError(): void {
    this.hasError.set(false);
    this.errorMessage.set('');
    this.reportedMessage.set(false);
    this.retry.emit();
  }

  reportCrash(): void {
    this.reportedMessage.set(true);
    const enrichedError = new Error(
      `[LingQ:${this.context().component}] Manual report: ${this.errorMessage()}`,
    );
    enrichedError.name = 'LingqManualReport';
    this.reportErrorInternal(enrichedError);
    this.report.emit(this.context());
  }

  private reportErrorInternal(error: Error): void {
    const ctx = this.context();
    const enriched = new LingqContextError(
      error.message,
      ctx,
      error.stack,
    );
    enriched.name = error.name;
    this.errorHandler.handleError(enriched);
  }
}
