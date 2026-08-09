import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ReadingEngineCrashContext {
  boundaryContext?: string;
  renderingError?: boolean;
  activeTab?: string;
  resourceId?: string;
  filterDifficulty?: string | null;
  filterTopic?: string | null;
  action?: string;
  componentStack?: string;
}

const MAX_RECENT_CRASHES = 10;

@Injectable({
  providedIn: 'root',
})
export class ReadingEngineErrorHandlerService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  readonly recentCrashes = signal<
    Array<{ message: string; timestamp: string; context: string }>
  >([]);

  private getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  /**
   * Report a reading-engine-specific crash with rich context.
   * Sends structured error data to the backend analytics endpoint and
   * maintains a local rolling buffer of recent crashes for UI display.
   */
  reportReadingEngineCrash(error: Error, context?: ReadingEngineCrashContext): void {
    const payload = {
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
        activeTab: context?.activeTab ?? undefined,
        resourceId: context?.resourceId ?? undefined,
        filterDifficulty: context?.filterDifficulty ?? undefined,
        filterTopic: context?.filterTopic ?? undefined,
        action: context?.action ?? undefined,
      },
      componentStack: context?.componentStack ?? undefined,
    };

    this.recentCrashes.update((crashes) =>
      [
        {
          message: payload.message,
          timestamp: payload.timestamp,
          context: context?.action ?? context?.boundaryContext ?? 'unknown',
        },
        ...crashes,
      ].slice(0, MAX_RECENT_CRASHES),
    );

    // Fire-and-forget: do not block the error propagation
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
   */
  async wrapReadingEngineCall<T>(
    action: string,
    fn: () => Promise<T>,
    extraContext?: Partial<ReadingEngineCrashContext>,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error(String(err));
      this.reportReadingEngineCrash(error, {
        action,
        ...extraContext,
      });
      return null;
    }
  }
}