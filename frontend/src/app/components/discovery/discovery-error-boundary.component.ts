import { Component, inject, signal, input, output, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { CrashReportService, CrashContext } from '../../services/crash-report.service';

@Component({
  selector: 'app-discovery-error-boundary',
  imports: [TranslatePipe],
  template: `
    @if (!hasError()) {
      <ng-content />
    } @else {
      <div
        [class.min-h-screen]="fullPage()"
        class="flex flex-col items-center justify-center p-8 bg-surface-500 gap-6"
        role="alert"
      >
        <div class="max-w-sm w-full text-center space-y-5">
          <div class="text-6xl" aria-hidden="true">🗺️</div>
          <h2 class="text-xl font-black text-text-primary">
            {{ 'discoveryErrorBoundary.title' | t }}
          </h2>
          <p class="text-sm text-text-secondary leading-relaxed">
            {{ 'discoveryErrorBoundary.description' | t }}
          </p>
          @if (errorMessage()) {
            <p class="rounded-xl bg-surface-300 p-3 text-xs font-mono text-rose-400 break-all">
              {{ errorMessage() }}
            </p>
          }
          @if (errorDetailHint()) {
            <p class="rounded-xl bg-surface-200 p-2 text-[11px] text-text-muted">
              {{ errorDetailHint() }}
            </p>
          }
          <div class="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              (click)="resetError()"
              class="rounded-xl bg-accent-500 hover:bg-accent-600 text-white font-bold py-2.5 px-6 text-sm transition-colors"
            >
              {{ 'discoveryErrorBoundary.retry' | t }}
            </button>
            @if (showReportButton()) {
              <button
                type="button"
                (click)="reportCrash()"
                class="rounded-xl border border-surface-200 hover:bg-surface-300 text-text-secondary font-bold py-2.5 px-6 text-sm transition-colors"
              >
                {{ 'discoveryErrorBoundary.report' | t }}
              </button>
            }
          </div>
          @if (reportConfirmed()) {
            <p class="text-xs text-emerald-400 font-bold">
              {{ 'discoveryErrorBoundary.reported' | t }}
            </p>
          }
        </div>
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
export class DiscoveryErrorBoundaryComponent {
  private crashReportService = inject(CrashReportService);

  readonly fullPage = input<boolean>(false);
  readonly showReportButton = input<boolean>(true);
  readonly featureContext = input<string>('discovery');
  readonly componentName = input<string>('DiscoveryMap');

  readonly retry = output<void>();

  readonly hasError = signal<boolean>(false);
  readonly errorMessage = signal<string>('');
  readonly reportConfirmed = signal<boolean>(false);
  readonly errorCount = signal<number>(0);

  private lastError: Error | null = null;

  readonly errorDetailHint = computed(() => {
    if (this.errorCount() <= 1) return '';
    return `Error count: ${this.errorCount()}. Component: ${this.componentName()}`;
  });

  captureError(error: Error, message?: string, extraMetadata?: Record<string, unknown>): void {
    this.lastError = error;
    this.hasError.set(true);
    this.errorCount.update((c) => c + 1);
    this.errorMessage.set(message ?? error.message ?? 'Unknown error in discovery');

    const crashContext: CrashContext = {
      feature: this.featureContext(),
      component: this.componentName(),
      renderingError: true,
      errorCount: this.errorCount(),
      action: extraMetadata?.['action'] as string | undefined,
      errorMessage: this.errorMessage(),
    };

    this.crashReportService.reportCrash(error, crashContext);
  }

  resetError(): void {
    this.hasError.set(false);
    this.errorMessage.set('');
    this.reportConfirmed.set(false);
    this.errorCount.set(0);
    this.lastError = null;
    this.retry.emit();
  }

  reportCrash(): void {
    if (this.lastError) {
      this.crashReportService.reportCrash(this.lastError, {
        feature: this.featureContext(),
        component: this.componentName(),
        action: 'manualReport',
        renderingError: true,
        errorMessage: this.errorMessage(),
        errorCount: this.errorCount(),
      });
    }
    this.reportConfirmed.set(true);
  }
}