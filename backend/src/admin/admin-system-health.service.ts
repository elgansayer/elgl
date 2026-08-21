import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminOperationalEventsService } from './admin-operational-events.service';

export type AdminHealthState = 'healthy' | 'degraded';

interface DependencyHealthCheck {
  state: AdminHealthState;
  latencyMs: number;
}

export interface AdminSystemHealthSnapshot {
  state: AdminHealthState;
  checkedAt: string;
  dependencies: {
    database: AdminHealthState;
    redis: AdminHealthState;
  };
  dependencyLatencyMs: {
    database: number;
    redis: number;
  };
}

const DEPENDENCY_TIMEOUT_MS = 2_000;

@Injectable()
export class AdminSystemHealthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly operationalEvents: AdminOperationalEventsService,
  ) {}

  async getSnapshot(): Promise<AdminSystemHealthSnapshot> {
    const [databaseCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const database = databaseCheck.state;
    const redis = redisCheck.state;
    const state =
      database === 'healthy' && redis === 'healthy' ? 'healthy' : 'degraded';
    const snapshot = {
      state,
      checkedAt: new Date().toISOString(),
      dependencies: { database, redis },
      dependencyLatencyMs: {
        database: databaseCheck.latencyMs,
        redis: redisCheck.latencyMs,
      },
    } satisfies AdminSystemHealthSnapshot;

    if (state === 'degraded') {
      try {
        await this.operationalEvents.record({
          severity: 'warning',
          category: 'system-health',
          message: `Dependency state degraded: database=${database}, redis=${redis}`,
          source: 'admin-system-health',
        });
      } catch {
        // Health reads must remain available even when the operational-event store
        // is one of the degraded dependencies. Recording is intentionally best effort.
      }
    }

    return snapshot;
  }

  private async checkDatabase(): Promise<DependencyHealthCheck> {
    const startedAt = Date.now();
    try {
      const result = await this.withTimeout(
        this.supabaseService
          .getClient()
          .from('admin_roles')
          .select('id')
          .limit(1),
      );
      return {
        state: result.error ? 'degraded' : 'healthy',
        latencyMs: Math.max(0, Date.now() - startedAt),
      };
    } catch {
      return {
        state: 'degraded',
        latencyMs: Math.max(0, Date.now() - startedAt),
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealthCheck> {
    const startedAt = Date.now();
    try {
      const response = await this.withTimeout(
        this.supabaseService.getRedisClient().ping(),
      );
      return {
        state: response === 'PONG' ? 'healthy' : 'degraded',
        latencyMs: Math.max(0, Date.now() - startedAt),
      };
    } catch {
      return {
        state: 'degraded',
        latencyMs: Math.max(0, Date.now() - startedAt),
      };
    }
  }

  private async withTimeout<T>(operation: PromiseLike<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        Promise.resolve(operation),
        new Promise<T>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('dependency health check timed out')),
            DEPENDENCY_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
