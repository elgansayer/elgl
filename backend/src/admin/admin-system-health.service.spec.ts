import { SupabaseService } from '../supabase/supabase.service';
import { AdminSystemHealthService } from './admin-system-health.service';

describe('AdminSystemHealthService', () => {
  it('reports healthy when database and redis respond', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ limit });
    const service = new AdminSystemHealthService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
      getRedisClient: vi.fn().mockReturnValue({
        ping: vi.fn().mockResolvedValue('PONG'),
      }),
    } as unknown as SupabaseService);

    const snapshot = await service.getSnapshot();
    expect(snapshot.state).toBe('healthy');
    expect(snapshot.dependencies).toEqual({
      database: 'healthy',
      redis: 'healthy',
    });
    expect(snapshot.checkedAt).toEqual(expect.any(String));
  });

  it('reports degraded without leaking dependency errors', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('database internal detail'),
    });
    const select = vi.fn().mockReturnValue({ limit });
    const service = new AdminSystemHealthService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
      getRedisClient: vi.fn().mockReturnValue({
        ping: vi.fn().mockRejectedValue(new Error('redis internal detail')),
      }),
    } as unknown as SupabaseService);

    const snapshot = await service.getSnapshot();
    expect(snapshot.state).toBe('degraded');
    expect(snapshot.dependencies).toEqual({
      database: 'degraded',
      redis: 'degraded',
    });
    expect(JSON.stringify(snapshot)).not.toContain('internal detail');
  });
});
