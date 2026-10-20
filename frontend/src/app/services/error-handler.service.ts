import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, PLATFORM_ID, inject } from '@angular/core';
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

const MAX_MESSAGE_LENGTH = 1000;
const MAX_NAME_LENGTH = 120;
const MAX_STACK_LENGTH = 12000;
const MAX_URL_LENGTH = 2048;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_STACK_FRAMES = 30;
const MAX_FRAME_TEXT_LENGTH = 512;
const STACK_FRAME_RE =
  /^\s*at\s+(?:(?<functionName>[^\s(]+)\s*\(?\s*(?<source>[^)]+)?\)?|(?<sourceOnly>[^\s(]+))$/;

function bounded(value: unknown, limit: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.slice(0, limit);
}

function privacySafeUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return bounded(`${parsed.origin}${parsed.pathname}`, MAX_URL_LENGTH);
  } catch {
    return '';
  }
}

function parseStackFrames(stack: string): ClientErrorStackFrame[] {
  return stack
    .split('\n')
    .slice(1, MAX_STACK_FRAMES + 1)
    .map((line): ClientErrorStackFrame | null => {
      const match = STACK_FRAME_RE.exec(line);
      if (!match) return null;

      const functionName = bounded(match.groups?.['functionName'], MAX_FRAME_TEXT_LENGTH) || undefined;
      const rawSource = match.groups?.['source'] ?? match.groups?.['sourceOnly'];
      if (!rawSource) return functionName ? { functionName } : null;

      const source = bounded(rawSource, MAX_FRAME_TEXT_LENGTH);
      const sourceMatch = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(source);
      return {
        functionName: functionName ?? '<anonymous>',
        fileName: bounded(sourceMatch?.[1] || source, MAX_FRAME_TEXT_LENGTH),
        lineNumber: sourceMatch?.[2] ? Number(sourceMatch[2]) : undefined,
        columnNumber: sourceMatch?.[3] ? Number(sourceMatch[3]) : undefined,
        source,
      };
    })
    .filter((frame): frame is ClientErrorStackFrame => frame !== null);
}

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private readonly apiService = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly inFlightFingerprints = new Set<string>();

  handleError(err: unknown): void {
    try {
      if (err instanceof HttpErrorResponse) {
        this.reportHttpError(err);
      } else if (err instanceof Error) {
        this.reportError(err);
      } else if (typeof err === 'string') {
        this.reportStringError(err);
      } else {
        this.reportUnknown(err);
      }
    } catch {
      // Error reporting must never turn one application failure into another.
    }

    if (err instanceof HttpErrorResponse) throw err;
    if (!(err instanceof Error) && typeof err === 'object' && err !== null) throw err;
  }

  private reportError(error: Error): void {
    const stack = bounded(error.stack, MAX_STACK_LENGTH) || undefined;
    this.sendPayload(
      {
        message: bounded(error.message, MAX_MESSAGE_LENGTH, 'Unknown client error'),
        name: bounded(error.name, MAX_NAME_LENGTH, 'Error'),
        stack,
        url: this.currentUrl(),
        userAgent: this.userAgent(),
        timestamp: new Date().toISOString(),
      },
      stack,
    );
  }

  private reportStringError(message: string): void {
    this.sendPayload({
      message: bounded(message, MAX_MESSAGE_LENGTH, 'Unknown client error'),
      name: 'UncaughtString',
      url: this.currentUrl(),
      userAgent: this.userAgent(),
      timestamp: new Date().toISOString(),
    });
  }

  private reportHttpError(error: HttpErrorResponse): void {
    this.sendPayload({
      message: bounded(`HTTP ${error.status}: ${error.message}`, MAX_MESSAGE_LENGTH),
      name: 'HttpError',
      url: privacySafeUrl(error.url ?? '') || this.currentUrl(),
      userAgent: this.userAgent(),
      timestamp: new Date().toISOString(),
      metadata: {
        status: Number.isFinite(error.status) ? error.status : 0,
        statusText: bounded(error.statusText, MAX_NAME_LENGTH),
      },
    });
  }

  private reportUnknown(err: unknown): void {
    let message = 'Unknown client error';
    let rawType = typeof err;

    if (typeof err === 'object' && err !== null) {
      try {
        const record = err as Record<string, unknown>;
        if (typeof record['message'] === 'string') message = record['message'];
        const constructor = record['constructor'];
        if (typeof constructor === 'function' && constructor.name) rawType = constructor.name;
      } catch {
        // A thrown Proxy/getter must not break global error reporting.
      }
    } else if (err !== undefined && err !== null) {
      message = String(err);
    }

    this.sendPayload({
      message: bounded(message, MAX_MESSAGE_LENGTH, 'Unknown client error'),
      name: 'UnknownThrowable',
      url: this.currentUrl(),
      userAgent: this.userAgent(),
      timestamp: new Date().toISOString(),
      metadata: { rawType: bounded(rawType, MAX_NAME_LENGTH, 'unknown') },
    });
  }

  private currentUrl(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    return privacySafeUrl(this.document.defaultView?.location?.href ?? '');
  }

  private userAgent(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    return bounded(this.document.defaultView?.navigator?.userAgent ?? '', MAX_USER_AGENT_LENGTH);
  }

  private sendPayload(payload: Omit<ClientErrorPayload, 'stackFrames'>, rawStack?: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const fullPayload: ClientErrorPayload = {
      ...payload,
      stackFrames: rawStack ? parseStackFrames(rawStack) : undefined,
    };
    const fingerprint = `${fullPayload.name}\u0000${fullPayload.message}\u0000${fullPayload.url}`;
    if (this.inFlightFingerprints.has(fingerprint)) return;
    this.inFlightFingerprints.add(fingerprint);

    void this.apiService
      .post('/api/analytics/client-error', fullPayload, { requireAuth: false })
      .catch(() => undefined)
      .finally(() => this.inFlightFingerprints.delete(fingerprint));
  }
}
