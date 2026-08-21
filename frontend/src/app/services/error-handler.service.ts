import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from './api.service';

interface ClientErrorStackFrame {
  fileName?: string;
  functionName?: string;
  source?: string;
  lineNumber?: number;
  columnNumber?: number;
}

interface ClientErrorPayload {
  message: string;
  name: string;
  stack?: string;
  componentStack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  stackFrames?: ClientErrorStackFrame[];
}

/**
 * Regex matching a single stack-frame line, typically from V8/SpiderMonkey engines.
 * Handles both the verbose form `at functionName (file:line:col)` and the
 * compact form `    at file:line:col`.
 */
const STACK_FRAME_RE =
  /^\s*at\s+(?:(?<functionName>[^\s(]+)\s*\(?\s*(?<source>[^)]+)?\)?|(?<sourceOnly>[^\s(]+))$/;

function parseStackFrames(stack: string): ClientErrorStackFrame[] {
  return stack
    .split('\n')
    .slice(1) // skip the first line (message)
    .map((line): ClientErrorStackFrame | null => {
      const m = STACK_FRAME_RE.exec(line);
      if (!m) return null;

      const fnName = m.groups?.['functionName'];
      const rawSource = m.groups?.['source'] ?? m.groups?.['sourceOnly'];

      if (!rawSource) {
        return fnName ? { functionName: fnName } : null;
      }

      // V8-style source: "file:///app.component.ts:42:10" or just "/app.component.ts:42:10"
      const sourceMatch = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(rawSource);
      return {
        functionName: fnName ?? '<anonymous>',
        fileName: sourceMatch?.[1] || rawSource,
        lineNumber: sourceMatch?.[2] ? Number(sourceMatch[2]) : undefined,
        columnNumber: sourceMatch?.[3] ? Number(sourceMatch[3]) : undefined,
        source: rawSource,
      };
    })
    .filter((f): f is ClientErrorStackFrame => f !== null);
}

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private apiService = inject(ApiService);

  handleError(err: unknown): void {
    // Always attempt to report; rethrow HttpErrorResponse
    // to preserve Angular's built-in behaviour.
    if (err instanceof Error) {
      this.reportError(err);
    } else if (typeof err === 'string') {
      this.reportStringError(err);
    } else if (err instanceof HttpErrorResponse) {
      this.reportHttpError(err);
      throw err;
    } else {
      this.reportUnknown(err);
    }

    // Preserve Angular's default: rethrow non-Error throwables
    // that aren't HttpErrorResponse.
    if (!(err instanceof Error) && !(err instanceof HttpErrorResponse) && typeof err === 'object') {
      throw err;
    }
  }

  private reportError(error: Error): void {
    this.sendPayload(
      {
        message: error.message || 'Unknown client error',
        name: error.name || 'Error',
        stack: error.stack,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        timestamp: new Date().toISOString(),
      },
      error.stack,
    );
  }

  private reportStringError(message: string): void {
    this.sendPayload({
      message,
      name: 'UncaughtString',
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
    });
  }

  private reportHttpError(error: HttpErrorResponse): void {
    this.sendPayload({
      message: `HTTP ${error.status}: ${error.message}`,
      name: 'HttpError',
      url: error.url ?? (typeof window !== 'undefined' ? window.location.href : ''),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      metadata: { status: error.status, statusText: error.statusText },
    });
  }

  private reportUnknown(err: unknown): void {
    let message: string;
    let metadata: Record<string, unknown> | undefined;

    if (typeof err === 'object' && err !== null) {
      const obj: Record<string, unknown> = Object(err);
      const objStr = obj['toString'];
      message = String(
        obj['message'] ?? (typeof objStr === 'function' ? objStr() : 'Unknown error object'),
      );
      metadata = { rawType: obj.constructor?.name ?? typeof err };
    } else {
      message = String(err);
    }

    this.sendPayload({
      message,
      name: 'UnknownThrowable',
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      metadata,
    });
  }

  private sendPayload(payload: Omit<ClientErrorPayload, 'stackFrames'>, rawStack?: string): void {
    const fullPayload: ClientErrorPayload = {
      ...payload,
      stackFrames: rawStack ? parseStackFrames(rawStack) : undefined,
    };

    // Fire-and-forget: do not block the error propagation
    this.apiService
      .post('/api/analytics/client-error', fullPayload, { requireAuth: false })
      .catch(() => {
        // Silently ignore: we cannot log a logging failure
      });
  }
}
