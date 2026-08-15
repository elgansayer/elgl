import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

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
  constructor(private readonly supabaseService: SupabaseService) {}

  async getSnapshot(): Promise<AdminSystemHealthSnapshot> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      state: database === 'healthy' && redis === 'healthy' ? 'healthy' : 'degraded',
      checkedAt: new Date().toISOString(),
      dependencies: { database, redis },
    };
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
