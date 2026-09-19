import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, signal, inject, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { DiscoveryErrorHandlerService } from '../../services/discovery-error-handler.service';
import { GlobalErrorHandler } from '../../services/error-handler.service';

export interface DiscoveryErrorContext {
  component: string;
  operation?: string;
  filterType?: string;
  targetLanguage?: string;
  nativeLanguage?: string;
  partnerCount?: number;
  sortMode?: string;
  radiusKm?: number;
  /** Additional metadata for richer crash reports */
  metadata?: Record<string, unknown>;
}

interface DiscoveryCrashPayload {
  errorName: string;
  errorMessage: string;
  component: string;
  operation?: string;
  context: DiscoveryErrorContext;
  timestamp: string;
  url: string;
  userAgent: string;
  stackFrames?: {
    fileName?: string;
    functionName?: string;
    lineNumber?: number;
    columnNumber?: number;
  }[];
}

class DiscoveryContextError extends Error {
  readonly discoveryContext: DiscoveryErrorContext;
  constructor(message: string, discoveryContext: DiscoveryErrorContext, stack?: string) {
    super(message);
    this.discoveryContext = discoveryContext;
    if (stack) {
      this.stack = stack;
    }
  }
}

const STACK_FRAME_RE =
  /^\s*at\s+(?:(?<functionName>[^\s(]+)\s*\(?\s*(?<source>[^)]+)?\)?|(?<sourceOnly>[^\s(]+))$/;

function parseStackFrames(stack: string): DiscoveryCrashPayload['stackFrames'] {
  return stack
    .split('\n')
    .slice(1)
    .map((line) => {
      const m = STACK_FRAME_RE.exec(line);
      if (!m) return null;
      const fnName = m.groups?.['functionName'];
      const rawSource = m.groups?.['source'] ?? m.groups?.['sourceOnly'];
      if (!rawSource) return fnName ? { functionName: fnName } : null;
      const sourceMatch = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(rawSource);
      return {
        functionName: fnName ?? '<anonymous>',
        fileName: sourceMatch?.[1] || rawSource,
        lineNumber: sourceMatch?.[2] ? Number(sourceMatch[2]) : undefined,
        columnNumber: sourceMatch?.[3] ? Number(sourceMatch[3]) : undefined,
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

@Component({
  selector: 'app-discovery-error-boundary',
  standalone: true,
  imports: [HlmButton, TranslatePipe],
  template: `
    @if (!hasError()) {
      <ng-content />
    } @else {
      <div class="mx-auto max-w-md space-y-4 pt-8 pb-16" role="alert">
        <section
          class="rounded-sheet border border-danger/30 bg-danger/10 p-6 text-center space-y-4"
        >
          <p class="text-4xl" aria-hidden="true">&#128269;</p>
          <h3 class="text-lg font-black text-danger">{{ 'discoveryErrorBoundary.title' | t }}</h3>
          <p class="text-sm text-text-secondary">{{ 'discoveryErrorBoundary.description' | t }}</p>
          @if (errorMessage()) {
            <p class="rounded-app bg-surface-200 p-3 text-xs font-mono text-danger break-all">
              {{ errorMessage() }}
            </p>
          }
          @if (errorDetailHint()) {
            <p class="rounded-app bg-surface-200 p-2 text-[11px] text-text-muted">
              {{ errorDetailHint() }}
            </p>
          }
          <div class="flex flex-wrap justify-center gap-3">
            <button hlmBtn type="button" size="touch" (click)="resetError()">
              {{ 'discoveryErrorBoundary.retryBtn' | t }}
            </button>
            @if (showReportButton()) {
              <button
                hlmBtn
                type="button"
                variant="outline"
                size="touch"
                (click)="reportCrash()"
              >
                {{ 'discoveryErrorBoundary.reportBtn' | t }}
              </button>
            }
          </div>
          @if (reportedMessage()) {
            <p class="text-xs text-success font-bold">
              {{ 'discoveryErrorBoundary.reportedMessage' | t }}
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
export class DiscoveryErrorBoundaryComponent {
  private discoveryErrorHandler = inject(DiscoveryErrorHandlerService);
  private errorHandler = inject(GlobalErrorHandler);

  readonly context = input<DiscoveryErrorContext>({ component: 'unknown' });
  readonly showReportButton = input(true);
  readonly retry = output<void>();
  readonly reportError = output<DiscoveryErrorContext>();

  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly reportedMessage = signal(false);
  /** Tracks how many times errors have been captured since last reset */
  readonly errorCount = signal(0);

  /** Human-readable hint about what was happening when the error occurred */
  readonly errorDetailHint = computed(() => {
    if (this.errorCount() <= 1) return '';
    return `Error count: ${this.errorCount()}. Last context: ${this.context().component}`;
  });

  /**
   * Captures an error and shows the error UI.
   * @param error - The thrown error
   * @param message - Optional user-facing message override
   * @param extraMetadata - Additional structured metadata for crash report
   */
  captureError(error: Error, message?: string, extraMetadata?: Record<string, unknown>): void {
    this.hasError.set(true);
    this.errorCount.update((c) => c + 1);
    this.errorMessage.set(message ?? error.message ?? 'Unknown error in discovery component');

    const enrichedError = new Error(
      `[Discovery:${this.context().component}] ${this.errorMessage()}`,
    );
    enrichedError.name = 'DiscoveryError';
    if (error.stack) {
      enrichedError.stack = error.stack;
    }

    this.reportErrorInternal(enrichedError, extraMetadata);
  }

  resetError(): void {
    this.hasError.set(false);
    this.errorMessage.set('');
    this.reportedMessage.set(false);
    this.errorCount.set(0);
    this.retry.emit();
  }

  reportCrash(): void {
    this.reportedMessage.set(true);
    const enrichedError = new Error(
      `[Discovery:${this.context().component}] Manual report: ${this.errorMessage()}`,
    );
    enrichedError.name = 'DiscoveryManualReport';
    this.reportErrorInternal(enrichedError);
    this.reportError.emit(this.context());
  }

  private reportErrorInternal(error: Error, extraMetadata?: Record<string, unknown>): void {
    const ctx = this.context();
    this.discoveryErrorHandler.reportDiscoveryCrash(error, {
      filterType: ctx.filterType,
      targetLanguage: ctx.targetLanguage,
      nativeLanguage: ctx.nativeLanguage,
      partnerCount: ctx.partnerCount,
      sortMode: ctx.sortMode,
      radiusKm: ctx.radiusKm,
      boundaryContext: ctx.component,
      renderingError: true,
    });

    // Also report to the global error handler for centralised logging
    const enriched = new DiscoveryContextError(
      error.message,
      {
        ...ctx,
        metadata: {
          ...(ctx.metadata ?? {}),
          ...(extraMetadata ?? {}),
          errorCount: this.errorCount(),
          timestamp: new Date().toISOString(),
        },
      },
      error.stack,
    );
    enriched.name = error.name;
    this.errorHandler.handleError(enriched);
  }

  /**
   * Build a structured crash payload for dashboard/diagnostic use.
   */
  static buildCrashPayload(error: Error, context: DiscoveryErrorContext): DiscoveryCrashPayload {
    return {
      errorName: error.name || 'UnknownError',
      errorMessage: error.message || 'No message',
      component: context.component,
      operation: context.operation,
      context,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      stackFrames: error.stack ? parseStackFrames(error.stack) : undefined,
    };
  }
}
