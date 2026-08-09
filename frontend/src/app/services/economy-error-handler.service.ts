import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { EconomyStore } from './economy.store';

export interface EconomyCrashContext {
  boundaryContext?: string;
  renderingError?: boolean;
  coinBalance?: number;
  activeTransaction?: string;
  componentStack?: string;
  action?: string;
}

const MAX_RECENT_CRASHES = 10;

@Injectable({
  providedIn: 'root',
})
export class EconomyErrorHandlerService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private economyStore = inject(EconomyStore);

  readonly recentCrashes = signal<
    Array<{ message: string; timestamp: string; context: string }>
  >([]);

  private getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  /**
   * Report an economy-specific crash with rich context.
   * This replaces all console.error calls in economy flows.
   */
  reportEconomyCrash(error: Error, context?: EconomyCrashContext): void {
    const payload = {
      message: error.message || 'Unknown economy crash',
      name: error.name || 'EconomyError',
      stack: error.stack ?? undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      metadata: {
        category: 'economy',
        coinBalance: context?.coinBalance ?? this.economyStore.coinsBalance(),
        activeTransaction: context?.activeTransaction ?? undefined,
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
   * Safe wrapper for economy API calls that reports crashes automatically.
   */
  async wrapEconomyCall<T>(
    action: string,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    try {
      return await fn();
    } catch (err: unknown) {
      const error =
        err instanceof Error ? err : new Error(String(err));
      this.reportEconomyCrash(error, {
        action,
        coinBalance: this.economyStore.coinsBalance(),
      });
      return null;
    }
  }
}