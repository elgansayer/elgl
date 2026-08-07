import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface EconomyCrashContext {
  boundaryContext?: string;
  renderingError?: boolean;
  coinBalance?: number;
  activeTransaction?: string;
  componentStack?: string;
  action?: string;
  componentName?: string;
}

export interface CrashReport {
  id: string;
  message: string;
  name: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  componentStack?: string;
  retryCount: number;
  lastRetryTimestamp?: string;
}

export interface CrashStats {
  totalCrashes: number;
  crashesLast24h: number;
  uniqueActions: number;
  topCrashActions: Array<{ action: string; count: number }>;
}

const MAX_RECENT_CRASHES = 20;
const MAX_OFFLINE_QUEUE = 50;
const CRASH_RETRY_MAX_ATTEMPTS = 3;
const OFFLINE_CRASH_STORE_KEY = 'offline_crash_reports';

@Injectable({
  providedIn: 'root',
})
export class EconomyErrorHandlerService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  readonly recentCrashes = signal<
    Array<{ message: string; timestamp: string; context: string }>
  >([]);

  readonly offlineQueueSize = signal<number>(0);
  readonly isSyncing = signal<boolean>(false);
  readonly lastSyncTimestamp = signal<string | null>(null);

  readonly crashStats = computed<CrashStats>(() => {
    const crashes = this.recentCrashes();
    const now = Date.now();
    const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const recent24h = crashes.filter((c) => c.timestamp >= last24h);

    const actionCounts = new Map<string, number>();
    for (const c of recent24h) {
      const ctx = c.context;
      actionCounts.set(ctx, (actionCounts.get(ctx) ?? 0) + 1);
    }

    const topActions = [...actionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([action, count]) => ({ action, count }));

    return {
      totalCrashes: crashes.length,
      crashesLast24h: recent24h.length,
      uniqueActions: actionCounts.size,
      topCrashActions: topActions,
    };
  });

  private getHeaders(): Record<string, string> {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  /**
   * Report an economy-specific crash with rich context.
   * Automatically queues offline if network unavailable.
   */
  reportEconomyCrash(error: Error, context?: EconomyCrashContext): void {
    const payload = this.buildCrashPayload(error, context);

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

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.queueCrashForOfflineSync(payload);
      return;
    }

    this.sendCrashReport(payload);
  }

  /**
   * Synchronises all queued offline crash reports to the server.
   */
  async syncOfflineCrashes(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing()) return { synced: 0, failed: 0 };

    this.isSyncing.set(true);
    let synced = 0;
    let failed = 0;

    try {
      const queued = this.loadOfflineCrashQueue();
      if (queued.length === 0) {
        this.offlineQueueSize.set(0);
        return { synced: 0, failed: 0 };
      }

      const remaining: CrashReport[] = [];

      for (const report of queued) {
        if (report.retryCount >= CRASH_RETRY_MAX_ATTEMPTS) {
          failed++;
          continue;
        }

        try {
          await this.sendCrashReportSync(report);
          synced++;
        } catch {
          report.retryCount++;
          report.lastRetryTimestamp = new Date().toISOString();
          remaining.push(report);
          failed++;
        }
      }

      this.persistOfflineCrashQueue(remaining);
      this.offlineQueueSize.set(remaining.length);

      if (synced > 0) {
        this.lastSyncTimestamp.set(new Date().toISOString());
      }
    } finally {
      this.isSyncing.set(false);
    }

    return { synced, failed };
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
      this.reportEconomyCrash(error, { action });
      return null;
    }
  }

  /**
   * Removes all locally stored crash data (offline queue and recent crashes).
   */
  clearCrashData(): void {
    this.recentCrashes.set([]);
    this.persistOfflineCrashQueue([]);
    this.offlineQueueSize.set(0);
  }

  private buildCrashPayload(
    error: Error,
    context?: EconomyCrashContext,
  ): Omit<CrashReport, 'retryCount' | 'lastRetryTimestamp'> {
    return {
      id: `crash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      message: error.message || 'Unknown economy crash',
      name: error.name || 'EconomyError',
      stack: error.stack ?? undefined,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: new Date().toISOString(),
      metadata: {
        category: 'economy',
        coinBalance: context?.coinBalance ?? undefined,
        activeTransaction: context?.activeTransaction ?? undefined,
        boundaryContext: context?.boundaryContext ?? undefined,
        renderingError: context?.renderingError ?? false,
        action: context?.action ?? undefined,
        componentName: context?.componentName ?? undefined,
      },
      componentStack: context?.componentStack ?? undefined,
    };
  }

  private sendCrashReport(
    payload: Omit<CrashReport, 'retryCount' | 'lastRetryTimestamp'>,
  ): void {
    firstValueFrom(
      this.http.post(`${environment.apiUrl}/analytics/client-error`, payload, {
        headers: { requireAuth: false } as Record<string, string>,
      }),
    ).catch(() => {
      this.queueCrashForOfflineSync(payload);
    });
  }

  private async sendCrashReportSync(
    report: CrashReport,
  ): Promise<void> {
    const { retryCount, lastRetryTimestamp, ...payload } = report;
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/analytics/client-error`, payload, {
        headers: { requireAuth: false } as Record<string, string>,
      }),
    );
  }

  private queueCrashForOfflineSync(
    payload: Omit<CrashReport, 'retryCount' | 'lastRetryTimestamp'>,
  ): void {
    const report: CrashReport = {
      ...payload,
      retryCount: 0,
    };

    const queue = this.loadOfflineCrashQueue();
    if (queue.length >= MAX_OFFLINE_QUEUE) {
      queue.shift();
    }
    queue.push(report);
    this.persistOfflineCrashQueue(queue);
    this.offlineQueueSize.set(queue.length);
  }

  private loadOfflineCrashQueue(): CrashReport[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const raw = localStorage.getItem(OFFLINE_CRASH_STORE_KEY);
      return raw ? (JSON.parse(raw) as CrashReport[]) : [];
    } catch {
      return [];
    }
  }

  private persistOfflineCrashQueue(queue: CrashReport[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(OFFLINE_CRASH_STORE_KEY, JSON.stringify(queue));
    } catch {
      // Storage full or unavailable
    }
  }
}