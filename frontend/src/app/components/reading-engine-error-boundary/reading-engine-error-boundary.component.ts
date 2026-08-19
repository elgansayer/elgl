import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, signal, inject, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ReadingEngineCrashReportingService } from '../../services/reading-engine-crash-reporting.service';
import { GlobalErrorHandler } from '../../services/error-handler.service';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';

export interface ReadingEngineErrorContext {
  component: string;
  operation?: string;
  articleLanguage?: string;
  activeArticleId?: string;
  resourceId?: string;
  tokenCount?: number;
  metadata?: Record<string, unknown>;
}

interface ReadingEngineCrashPayload {
  errorName: string;
  errorMessage: string;
  component: string;
  operation?: string;
  context: ReadingEngineErrorContext;
  timestamp: string;
  url: string;
  userAgent: string;
  stackFrames?: Array<{
    fileName?: string;
    functionName?: string;
    lineNumber?: number;
    columnNumber?: number;
  }>;
}

class ReadingEngineContextError extends Error {
  readonly readingContext: ReadingEngineErrorContext;
  constructor(message: string, readingContext: ReadingEngineErrorContext, stack?: string) {
    super(message);
    this.readingContext = readingContext;
    if (stack) {
      this.stack = stack;
    }
  }
}

const STACK_FRAME_RE =
  /^\s*at\s+(?:(?<functionName>[^\s(]+)\s*\(?\s*(?<source>[^)]+)?\)?|(?<sourceOnly>[^\s(]+))$/;

function parseStackFrames(stack: string): ReadingEngineCrashPayload['stackFrames'] {
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
  selector: 'app-reading-engine-error-boundary',
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
          <p class="text-4xl" aria-hidden="true">&#128214;</p>
          <h3 class="text-lg font-black text-danger">
            {{ 'readingEngineErrorBoundary.title' | t }}
          </h3>
          <p class="text-sm text-text-secondary">
            {{ 'readingEngineErrorBoundary.description' | t }}
          </p>
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
              {{ 'readingEngineErrorBoundary.retryBtn' | t }}
            </app-button-primary>
            @if (showReportButton()) {
              <button
                hlmBtn
                type="button"
                (click)="reportCrash()"
                class="rounded-app border border-surface-100 ps-4 pe-4 pt-2.5 pb-2.5 text-xs font-bold text-text-secondary hover:bg-surface-200"
              >
                {{ 'readingEngineErrorBoundary.reportBtn' | t }}
              </button>
            }
          </div>
          @if (reportedMessage()) {
            <p class="text-xs text-success font-bold">
              {{ 'readingEngineErrorBoundary.reportedMessage' | t }}
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
  private crashReportingService = inject(ReadingEngineCrashReportingService);
  private errorHandler = inject(GlobalErrorHandler);

  readonly context = input<ReadingEngineErrorContext>({ component: 'unknown' });
  readonly showReportButton = input(true);
  readonly retry = output<void>();
  readonly reportError = output<ReadingEngineErrorContext>();

  readonly hasError = signal(false);
  readonly errorMessage = signal('');
  readonly reportedMessage = signal(false);
  readonly errorCount = signal(0);

  readonly errorDetailHint = computed(() => {
    if (this.errorCount() <= 1) return '';
    return `Error count: ${this.errorCount()}. Last context: ${this.context().component}`;
  });

  captureError(error: Error, message?: string, extraMetadata?: Record<string, unknown>): void {
    this.hasError.set(true);
    this.errorCount.update((c) => c + 1);
    this.errorMessage.set(message ?? error.message ?? 'Unknown error in reading engine component');

    const enrichedError = new Error(
      `[ReadingEngine:${this.context().component}] ${this.errorMessage()}`,
    );
    enrichedError.name = 'ReadingEngineError';
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
      `[ReadingEngine:${this.context().component}] Manual report: ${this.errorMessage()}`,
    );
    enrichedError.name = 'ReadingEngineManualReport';
    this.reportErrorInternal(enrichedError);
    this.reportError.emit(this.context());
  }

  private reportErrorInternal(error: Error, extraMetadata?: Record<string, unknown>): void {
    const ctx = this.context();
    this.crashReportingService.reportCrash(error, {
      boundaryContext: ctx.component,
      renderingError: true,
      articleLanguage: ctx.articleLanguage,
      activeArticleId: ctx.activeArticleId,
      operation: ctx.operation,
      resourceId: ctx.resourceId,
      tokenCount: ctx.tokenCount,
    });

    const enriched = new ReadingEngineContextError(
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

  static buildCrashPayload(
    error: Error,
    context: ReadingEngineErrorContext,
  ): ReadingEngineCrashPayload {
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
