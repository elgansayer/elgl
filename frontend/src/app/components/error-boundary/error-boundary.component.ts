import {
  Component,
  inject,
  signal,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { EconomyErrorHandlerService } from '../../services/economy-error-handler.service';

@Component({
  selector: 'app-error-boundary',
  imports: [TranslatePipe],
  template: `
    @if (hasError()) {
      <div
        class="flex flex-col items-center justify-center p-8"
        [class.min-h-screen]="fullPage()"
        [class.min-h-[300px]]="!fullPage()"
      >
        <div class="text-center max-w-md w-full">
          <div class="text-5xl mb-4" aria-hidden="true">🪙</div>
          <h2 class="text-xl font-bold text-white mb-3">
            {{ 'errorBoundary.title' | t }}
          </h2>
          <p class="text-slate-400 mb-4 text-sm">
            {{ 'errorBoundary.message' | t }}
          </p>

          @if (errorSummary()) {
            <p class="rounded-lg bg-slate-800/80 p-3 text-xs font-mono text-rose-300 break-all mb-4 border border-rose-500/20">
              {{ errorSummary() }}
            </p>
          }

          @if (showDiagnostics()) {
            <div class="rounded-lg bg-slate-800/50 p-3 mb-4 text-start text-xs text-slate-400 space-y-1 border border-slate-700/50">
              <p><span class="text-slate-500">Context:</span> {{ context() }}</p>
              <p><span class="text-slate-500">Error Type:</span> {{ errorType() }}</p>
              @if (errorCount() > 1) {
                <p class="text-amber-400">
                  {{ 'errorBoundary.repeatedCrashes' | t: { count: errorCount() } }}
                </p>
              }
              @if (offlineQueueSize() > 0) {
                <p class="text-amber-400">
                  {{ 'errorBoundary.pendingReports' | t: { count: offlineQueueSize() } }}
                </p>
              }
            </div>
          }

          <div class="flex gap-3 justify-center flex-wrap">
            @if (showRetry()) {
              <button
                (click)="resetError()"
                class="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 text-sm active:scale-95"
              >
                {{ 'errorBoundary.retry' | t }}
              </button>
            }
            <button
              (click)="reportCrash()"
              class="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 text-sm active:scale-95"
              [class.bg-emerald-700]="reported()"
            >
              @if (reported()) {
                {{ 'errorBoundary.reported' | t }}
              } @else {
                {{ 'errorBoundary.report' | t }}
              }
            </button>
            @if (showClearData()) {
              <button
                (click)="clearAllCrashData()"
                class="bg-rose-800/50 hover:bg-rose-700/50 text-rose-300 font-semibold py-2.5 px-6 rounded-xl transition-all duration-200 text-xs active:scale-95 border border-rose-500/30"
              >
                {{ 'errorBoundary.clearData' | t }}
              </button>
            }
          </div>

          @if (reported()) {
            <p class="text-xs text-emerald-400 font-semibold mt-3">
              {{ 'errorBoundary.reportedMessage' | t }}
            </p>
          }
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
  readonly showDiagnostics = input<boolean>(true);
  readonly showClearData = input<boolean>(false);

  readonly errorCleared = output<void>();
  readonly crashReported = output<string>();

  readonly hasError = signal<boolean>(false);
  readonly errorSummary = signal<string>('');
  readonly errorType = signal<string>('');
  readonly reported = signal<boolean>(false);
  readonly errorCount = signal<number>(0);

  readonly offlineQueueSize = this.economyErrorHandler.offlineQueueSize;

  private lastError: Error | null = null;

  resetError(): void {
    this.hasError.set(false);
    this.errorSummary.set('');
    this.errorType.set('');
    this.lastError = null;
    this.errorCleared.emit();
  }

  reportCrash(): void {
    if (this.lastError) {
      this.economyErrorHandler.reportEconomyCrash(
        this.lastError,
        {
          boundaryContext: this.context(),
          componentName: 'ErrorBoundaryComponent',
        },
      );
    } else if (this.hasError()) {
      const syntheticError = new Error(
        `Manual crash report from boundary: ${this.errorSummary() || 'unknown error'}`,
      );
      syntheticError.name = 'ManualCrashReport';
      this.economyErrorHandler.reportEconomyCrash(syntheticError, {
        boundaryContext: this.context(),
        componentName: 'ErrorBoundaryComponent',
      });
    }
    this.reported.set(true);
    this.crashReported.emit(this.context());
  }

  clearAllCrashData(): void {
    this.economyErrorHandler.clearCrashData();
    this.errorCount.set(0);
    this.reported.set(false);
  }

  /**
   * Called when a child component throws during change detection or rendering.
   */
  handleBoundaryError(error: Error, componentName?: string): void {
    this.lastError = error;
    this.hasError.set(true);
    this.errorSummary.set(error.message || 'Unknown rendering error');
    this.errorType.set(error.name || 'Error');
    this.errorCount.update((c) => c + 1);
    this.reported.set(false);

    this.economyErrorHandler.reportEconomyCrash(error, {
      boundaryContext: this.context(),
      renderingError: true,
      componentName: componentName ?? 'ErrorBoundaryComponent',
    });
  }
}