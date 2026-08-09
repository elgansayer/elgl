import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ReadingEngineCrashContext {
  boundaryContext?: string;
  renderingError?: boolean;
  articleLanguage?: string;
  activeArticleId?: string;
  operation?: string;
  resourceId?: string;
  tokenCount?: number;
  additionalContext?: Record<string, unknown>;
}

interface ReadingEngineCrashPayload {
  message: string;
  name: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  metadata: {
    category: string;
    boundaryContext?: string;
    renderingError: boolean;
    articleLanguage?: string;
    activeArticleId?: string;
    operation?: string;
    resourceId?: string;
    tokenCount?: number;
  };
  componentStack?: string;
  stackFrames?: Array<{
    fileName?: string;
    functionName?: string;
    lineNumber?: number;
    columnNumber?: number;
  }>;
}

const MAX_RECENT_CRASHES = 10;

const STACK_FRAME_RE =
  /^\s*at\s+(?:(?<functionName>[^\s(]+)\s*\(?\s*(?<source>[^)]+)?\)?|(?<sourceOnly>[^\s(]+))$/;

function parseStackFrames(
  stack: string,
): ReadingEngineCrashPayload['stackFrames'] {
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

@Injectable({
  providedIn: 'root',
})
export class ReadingEngineCrashReportingService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  readonly recentCrashes = signal<
    Array<{ message: string; timestamp: string; context: string }>
  >([]);

  /**
   * Report a reading-engine-specific crash with rich context for debugging.
   */
  reportCrash(error: Error, context?: ReadingEngineCrashContext): void {
    const payload: ReadingEngineCrashPayload = {
      message: error.message || 'Unknown reading engine crash',
      name: error.name || 'ReadingEngineError',
      stack: error.stack ?? undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      metadata: {
        category: 'reading-engine',
        boundaryContext: context?.boundaryContext ?? undefined,
        renderingError: context?.renderingError ?? false,
        articleLanguage: context?.articleLanguage ?? undefined,
        activeArticleId: context?.activeArticleId ?? undefined,
        operation: context?.operation ?? undefined,
        resourceId: context?.resourceId ?? undefined,
        tokenCount: context?.tokenCount ?? undefined,
      },
      componentStack: context?.additionalContext
        ? JSON.stringify(context.additionalContext)
        : undefined,
      stackFrames: error.stack ? parseStackFrames(error.stack) : undefined,
    };

    this.recentCrashes.update((crashes) =>
      [
        {
          message: payload.message,
          timestamp: payload.timestamp,
          context: context?.operation ?? context?.boundaryContext ?? 'unknown',
        },
        ...crashes,
      ].slice(0, MAX_RECENT_CRASHES),
    );

    // Fire-and-forget: never block crash handling on network
    firstValueFrom(
      this.http.post(`${environment.apiUrl}/analytics/client-error`, payload, {
        headers: this.getHeaders(),
      }),
    ).catch(() => {
      // Cannot log a logging failure
    });
  }

  /**
   * Safe wrapper for reading engine API calls that reports crashes automatically.
   * Returns null on failure so callers can gracefully degrade.
   */
  async wrapCall<T>(operation: string, fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.reportCrash(error, { operation });
      return null;
    }
  }

  private getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }
}