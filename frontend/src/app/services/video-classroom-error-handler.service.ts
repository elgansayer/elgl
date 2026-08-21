import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { withRetry, HttpRetryOptions } from './http-retry';

export interface VideoClassroomCrashContext {
  roomId?: string;
  roomName?: string;
  isHost?: boolean;
  isCoHost?: boolean;
  livekitConnected?: boolean;
  renderingError?: boolean;
  boundaryContext?: string;
  componentStack?: string;
  action?: string;
}

const MAX_RECENT_CRASHES = 10;
const MAX_STACK_LENGTH = 2000;
const MAX_MESSAGE_LENGTH = 500;

@Injectable({
  providedIn: 'root',
})
export class VideoClassroomErrorHandlerService {
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
   * Report a video-classroom-specific crash with rich context.
   */
  reportVideoClassroomCrash(error: Error, context?: VideoClassroomCrashContext): void {
    const rawStack = error.stack ?? '';
    const payload = {
      message: (error.message || 'Unknown video classroom crash').slice(0, MAX_MESSAGE_LENGTH),
      name: error.name || 'VideoClassroomError',
      stack: rawStack.length > MAX_STACK_LENGTH
        ? rawStack.slice(0, MAX_STACK_LENGTH) + '...'
        : rawStack || undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      metadata: {
        category: 'video-classroom',
        roomId: context?.roomId ?? undefined,
        roomName: context?.roomName ?? undefined,
        isHost: context?.isHost ?? false,
        isCoHost: context?.isCoHost ?? false,
        livekitConnected: context?.livekitConnected ?? false,
        boundaryContext: context?.boundaryContext ?? undefined,
        renderingError: context?.renderingError ?? false,
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

    // Fire-and-forget: do not block
    firstValueFrom(
      this.http.post(`${environment.apiUrl}/analytics/client-error`, payload, {
        headers: this.getHeaders(),
      }),
    ).catch(() => {
      // Cannot log a logging failure
    });
  }

  /**
   * Safe wrapper for video classroom API calls with exponential backoff retry
   * for HTTP 429 (Too Many Requests) errors and automatic crash reporting.
   *
   * @param action - Label for crash reporting.
   * @param fn - The async operation to wrap.
   * @param context - Optional crash context metadata.
   * @param retryOptions - Optional retry configuration (defaults: maxRetries=3, baseDelayMs=500).
   */
  async wrapClassroomCall<T>(
    action: string,
    fn: () => Promise<T>,
    context?: VideoClassroomCrashContext,
    retryOptions?: HttpRetryOptions,
  ): Promise<T | null> {
    try {
      return await withRetry(fn, retryOptions);
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error(String(err));
      this.reportVideoClassroomCrash(error, {
        ...context,
        action,
      });
      return null;
    }
  }
}