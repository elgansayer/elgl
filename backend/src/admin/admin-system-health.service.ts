import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminOperationalEventsService } from './admin-operational-events.service';

export type AdminHealthState = 'healthy' | 'degraded';

export interface AdminSystemHealthSnapshot {
  state: AdminHealthState;
  checkedAt: string;
  dependencies: {
    database: AdminHealthState;
    redis: AdminHealthState;
  };
}

@Injectable()
export class AdminSystemHealthService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly operationalEvents: AdminOperationalEventsService,
  ) {}

  async getSnapshot(): Promise<AdminSystemHealthSnapshot> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);
    const state =
      database === 'healthy' && redis === 'healthy' ? 'healthy' : 'degraded';
    const snapshot = {
      state,
      checkedAt: new Date().toISOString(),
      dependencies: { database, redis },
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

  private async checkDatabase(): Promise<AdminHealthState> {
    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('admin_roles')
        .select('id')
        .limit(1);
      return error ? 'degraded' : 'healthy';
    } catch {
      return 'degraded';
    }
  }

  private async checkRedis(): Promise<AdminHealthState> {
    try {
      const response = await this.supabaseService.getRedisClient().ping();
      return response === 'PONG' ? 'healthy' : 'degraded';
    } catch {
      return 'degraded';
    }
  }
}
