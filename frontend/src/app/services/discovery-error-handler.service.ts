import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface DiscoveryCrashContext {
  filterType?: string;
  targetLanguage?: string;
  nativeLanguage?: string;
  partnerCount?: number;
  isVip?: boolean;
  sortMode?: string;
  radiusKm?: number;
  renderingError?: boolean;
  boundaryContext?: string;
  componentStack?: string;
  action?: string;
}

const MAX_RECENT_CRASHES = 10;

@Injectable({
  providedIn: 'root',
})
export class DiscoveryErrorHandlerService {
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
   * Report a discovery-specific crash with rich context.
   */
  reportDiscoveryCrash(error: Error, context?: DiscoveryCrashContext): void {
    const payload = {
      message: error.message || 'Unknown discovery crash',
      name: error.name || 'DiscoveryError',
      stack: error.stack ?? undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      metadata: {
        category: 'discovery',
        filterType: context?.filterType ?? undefined,
        targetLanguage: context?.targetLanguage ?? undefined,
        nativeLanguage: context?.nativeLanguage ?? undefined,
        partnerCount: context?.partnerCount ?? undefined,
        isVip: context?.isVip ?? false,
        sortMode: context?.sortMode ?? undefined,
        radiusKm: context?.radiusKm ?? undefined,
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
   * Safe wrapper for discovery API calls that reports crashes automatically.
   */
  async wrapDiscoveryCall<T>(
    action: string,
    fn: () => Promise<T>,
    context?: DiscoveryCrashContext,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error(String(err));
      this.reportDiscoveryCrash(error, {
        ...context,
        action,
      });
      return null;
    }
  }
}