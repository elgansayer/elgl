import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface CrashContext {
  feature: string;
  component?: string;
  action?: string;
  renderingError?: boolean;
  errorCount?: number;
  errorMessage?: string;
}

const MAX_RECENT_CRASHES = 20;

@Injectable({ providedIn: 'root' })
export class CrashReportService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  readonly recentCrashes = signal<
    Array<{ message: string; timestamp: string; feature: string }>
  >([]);

  private getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  reportCrash(error: Error, context: CrashContext): void {
    const payload = {
      message: error.message || 'Unknown crash',
      name: error.name || 'Error',
      stack: error.stack ?? undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      metadata: {
        feature: context.feature,
        component: context.component,
        action: context.action,
        renderingError: context.renderingError ?? false,
        errorCount: context.errorCount,
        errorMessage: context.errorMessage,
      },
    };

    this.recentCrashes.update((crashes) =>
      [
        {
          message: payload.message,
          timestamp: payload.timestamp,
          feature: context.feature,
        },
        ...crashes,
      ].slice(0, MAX_RECENT_CRASHES),
    );

    firstValueFrom(
      this.http.post(`${environment.apiUrl}/analytics/client-error`, payload, {
        headers: this.getHeaders(),
      }),
    ).catch(() => {
      // Fire-and-forget: silently ignore logging failures
    });
  }

  async wrapCall<T>(
    feature: string,
    action: string,
    fn: () => Promise<T>,
    fallback: T,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.reportCrash(error, { feature, action });
      return fallback;
    }
  }
}