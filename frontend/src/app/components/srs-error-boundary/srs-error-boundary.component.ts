import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, signal, inject, ErrorHandler, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

export interface SrsErrorContext {
  component: string;
  operation?: string;
  deckId?: string;
  cardCount?: number;
  currentIndex?: number;
  srsLevel?: number;
  /** Additional metadata for richer crash reports */
  metadata?: Record<string, unknown>;
}

interface SrsCrashPayload {
  errorName: string;
  errorMessage: string;
  component: string;
  operation?: string;
  context: SrsErrorContext;
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

class SrsContextError extends Error {
  readonly srsContext: SrsErrorContext;
  constructor(message: string, srsContext: SrsErrorContext, stack?: string) {
    super(message);
    this.srsContext = srsContext;
    if (stack) {
      this.stack = stack;
    }
  }
}

const STACK_FRAME_RE =
  /^\s*at\s+(?:(?<functionName>[^\s(]+)\s*\(?\s*(?<source>[^)]+)?\)?|(?<sourceOnly>[^\s(]+))$/;

function parseStackFrames(stack: string): SrsCrashPayload['stackFrames'] {
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
  selector: 'app-srs-error-boundary',
  standalone: true,
  imports: [HlmButton, TranslatePipe, AppButtonPrimaryComponent],
  template: `
    @if (!hasError()) {
      <ng-content />
    } @else {
      <div class="mx-auto max-w-md space-y-4 pt-8 pb-16" role="alert">
        <section
          class="rounded-sheet border border-danger/30 bg-danger/10 p-6 text-center space-y-4"
        >
          <p class="text-4xl" aria-hidden="true">&#9888;&#65039;</p>
          <h3 class="text-lg font-black text-danger">{{ 'srsErrorBoundary.title' | t }}</h3>
          <p class="text-sm text-text-secondary">{{ 'srsErrorBoundary.description' | t }}</p>
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
            <app-button-primary (clicked)="resetError()" customClass="text-xs">
              {{ 'srsErrorBoundary.retryBtn' | t }}
            </app-button-primary>
            @if (showReportButton()) {
              <button
                hlmBtn
                type="button"
                (click)="reportCrash()"
                class="rounded-app border border-surface-100 ps-4 pe-4 pt-2.5 pb-2.5 text-xs font-bold text-text-secondary hover:bg-surface-200"
              >
                {{ 'srsErrorBoundary.reportBtn' | t }}
              </button>
            }
          </div>
          @if (reportedMessage()) {
            <p class="text-xs text-success font-bold">
              {{ 'srsErrorBoundary.reportedMessage' | t }}
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
export class SrsErrorBoundaryComponent {
  private errorHandler = inject(ErrorHandler);

  readonly context = input<SrsErrorContext>({ component: 'unknown' });
  readonly showReportButton = input(true);
  readonly retry = output<void>();
  readonly reportError = output<SrsErrorContext>();

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
    this.errorMessage.set(message ?? error.message ?? 'Unknown error in SRS component');

    const enrichedError = new Error(`[SRS:${this.context().component}] ${this.errorMessage()}`);
    enrichedError.name = 'SrsError';
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
      `[SRS:${this.context().component}] Manual report: ${this.errorMessage()}`,
    );
    enrichedError.name = 'SrsManualReport';
    this.reportErrorInternal(enrichedError);
    this.reportError.emit(this.context());
  }

  private reportErrorInternal(error: Error, extraMetadata?: Record<string, unknown>): void {
    const ctx = {
      ...this.context(),
      metadata: {
        ...(this.context().metadata ?? {}),
        ...(extraMetadata ?? {}),
        errorCount: this.errorCount(),
        timestamp: new Date().toISOString(),
      },
    };
    const enriched = new SrsContextError(error.message, ctx, error.stack);
    enriched.name = error.name;
    this.errorHandler.handleError(enriched);
  }

  /**
   * Build a structured crash payload that can be sent to the analytics endpoint.
   * Useful for SRS-specific crash reporting dashboards.
   */
  static buildCrashPayload(error: Error, context: SrsErrorContext): SrsCrashPayload {
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
