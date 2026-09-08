import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, inject } from '@angular/core';
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
  url: string;
  userAgent: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean>;
  stackFrames?: ClientErrorStackFrame[];
}

const MAX_MESSAGE_LENGTH = 1000;
const MAX_NAME_LENGTH = 100;
const MAX_STACK_LENGTH = 12000;
const MAX_URL_LENGTH = 2048;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_STACK_FRAMES = 20;
const MAX_FRAME_VALUE_LENGTH = 512;
const REPORT_WINDOW_MS = 60_000;
const MAX_REPORTS_PER_WINDOW = 10;
const DUPLICATE_WINDOW_MS = 10_000;

const STACK_FRAME_RE =
  /^\s*at\s+(?:(?<functionName>[^\s(]+)\s*\(?\s*(?<source>[^)]+)?\)?|(?<sourceOnly>[^\s(]+))$/;
const BEARER_TOKEN_RE = /\bBearer\s+[^\s,;]+/gi;
const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const SECRET_PARAM_RE =
  /\b(authorization|access[_-]?token|refresh[_-]?token|api[_-]?key|password)=([^\s&#]+)/gi;

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

function redactSecrets(value: string): string {
  return value
    .replace(BEARER_TOKEN_RE, 'Bearer [redacted]')
    .replace(JWT_RE, '[redacted-jwt]')
    .replace(SECRET_PARAM_RE, '$1=[redacted]');
}

function sanitiseText(value: string, maxLength: number): string {
  return truncate(redactSecrets(value), maxLength);
}

function sanitiseUrl(value: string): string {
  if (!value) return '';

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://localhost';
    const parsed = new URL(value, base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return truncate(`${parsed.origin}${parsed.pathname}`, MAX_URL_LENGTH);
  } catch {
    return '';
  }
}

function currentUrl(): string {
  return typeof window === 'undefined' ? '' : sanitiseUrl(window.location.href);
}

function currentUserAgent(): string {
  return typeof navigator === 'undefined'
    ? ''
    : sanitiseText(navigator.userAgent, MAX_USER_AGENT_LENGTH);
}

function parseStackFrames(stack: string): ClientErrorStackFrame[] {
  return stack
    .split('\n')
    .slice(1)
    .map((line): ClientErrorStackFrame | null => {
      const match = STACK_FRAME_RE.exec(line);
      if (!match) return null;

      const functionName = match.groups?.['functionName'];
      const rawSource = match.groups?.['source'] ?? match.groups?.['sourceOnly'];
      if (!rawSource) {
        return functionName
          ? { functionName: sanitiseText(functionName, MAX_FRAME_VALUE_LENGTH) }
          : null;
      }

      const cleanSource = sanitiseText(rawSource, MAX_FRAME_VALUE_LENGTH);
      const sourceMatch = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(cleanSource);
      return {
        functionName: sanitiseText(functionName ?? '<anonymous>', MAX_FRAME_VALUE_LENGTH),
        fileName: sanitiseText(sourceMatch?.[1] || cleanSource, MAX_FRAME_VALUE_LENGTH),
        lineNumber: sourceMatch?.[2] ? Number(sourceMatch[2]) : undefined,
        columnNumber: sourceMatch?.[3] ? Number(sourceMatch[3]) : undefined,
        source: cleanSource,
      };
    })
    .filter((frame): frame is ClientErrorStackFrame => frame !== null)
    .slice(0, MAX_STACK_FRAMES);
}

function unwrapError(value: unknown): Error | null {
  if (value instanceof Error) return value;
  if (!value || typeof value !== 'object') return null;

  for (const key of ['rejection', 'ngOriginalError', 'originalError']) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor?.value instanceof Error) return descriptor.value;
    } catch {
      return null;
    }
  }

  return null;
}

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private readonly apiService = inject(ApiService);
  private windowStartedAt = 0;
  private reportsInWindow = 0;
  private readonly recentFingerprints = new Map<string, number>();

  handleError(err: unknown): void {
    try {
      if (err instanceof HttpErrorResponse) {
        this.reportHttpError(err);
        return;
      }

      const unwrapped = unwrapError(err);
      if (unwrapped) {
        this.reportError(unwrapped);
      } else if (typeof err === 'string') {
        this.reportStringError(err);
      } else {
        this.reportUnknown(err);
      }
    } catch {
      // The global handler must never create a second application failure.
    }
  }

  private reportError(error: Error): void {
    const stack = error.stack
      ? sanitiseText(error.stack, MAX_STACK_LENGTH)
      : undefined;

    this.sendPayload({
      message: sanitiseText(error.message || 'Client runtime error', MAX_MESSAGE_LENGTH),
      name: sanitiseText(error.name || 'Error', MAX_NAME_LENGTH),
      stack,
      url: currentUrl(),
      userAgent: currentUserAgent(),
      timestamp: new Date().toISOString(),
      stackFrames: stack ? parseStackFrames(stack) : undefined,
    });
  }

  private reportStringError(message: string): void {
    this.sendPayload({
      message: sanitiseText(message || 'Client runtime error', MAX_MESSAGE_LENGTH),
      name: 'UncaughtString',
      url: currentUrl(),
      userAgent: currentUserAgent(),
      timestamp: new Date().toISOString(),
    });
  }

  private reportHttpError(error: HttpErrorResponse): void {
    this.sendPayload({
      message: sanitiseText(`HTTP ${error.status}: ${error.message}`, MAX_MESSAGE_LENGTH),
      name: 'HttpError',
      url: sanitiseUrl(error.url ?? currentUrl()),
      userAgent: currentUserAgent(),
      timestamp: new Date().toISOString(),
      metadata: {
        status: error.status,
        statusText: sanitiseText(error.statusText || 'Unknown', 200),
      },
    });
  }

  private reportUnknown(err: unknown): void {
    const primitiveMessage =
      typeof err === 'number' || typeof err === 'boolean' || typeof err === 'bigint'
        ? String(err)
        : 'Unknown client throwable';

    this.sendPayload({
      message: sanitiseText(primitiveMessage, MAX_MESSAGE_LENGTH),
      name: 'UnknownThrowable',
      url: currentUrl(),
      userAgent: currentUserAgent(),
      timestamp: new Date().toISOString(),
      metadata: { rawType: typeof err },
    });
  }

  private canReport(payload: ClientErrorPayload): boolean {
    if (typeof window === 'undefined') return false;

    const now = Date.now();
    if (now - this.windowStartedAt >= REPORT_WINDOW_MS) {
      this.windowStartedAt = now;
      this.reportsInWindow = 0;
      this.recentFingerprints.clear();
    }

    if (this.reportsInWindow >= MAX_REPORTS_PER_WINDOW) return false;

    const fingerprint = `${payload.name}\u0000${payload.message}\u0000${payload.stackFrames?.[0]?.source ?? ''}`;
    const lastReportedAt = this.recentFingerprints.get(fingerprint);
    if (lastReportedAt !== undefined && now - lastReportedAt < DUPLICATE_WINDOW_MS) {
      return false;
    }

    for (const [key, timestamp] of this.recentFingerprints) {
      if (now - timestamp >= DUPLICATE_WINDOW_MS) this.recentFingerprints.delete(key);
    }

    this.recentFingerprints.set(fingerprint, now);
    this.reportsInWindow += 1;
    return true;
  }

  private sendPayload(payload: ClientErrorPayload): void {
    if (!this.canReport(payload)) return;

    this.apiService
      .post('/api/analytics/client-error', payload, { requireAuth: false })
      .catch(() => {
        // Reporting is deliberately best-effort to prevent recursive failures.
      });
  }
}
