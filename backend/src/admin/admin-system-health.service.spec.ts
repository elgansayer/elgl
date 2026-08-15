import { SupabaseService } from '../supabase/supabase.service';
import { AdminOperationalEventsService } from './admin-operational-events.service';
import { AdminSystemHealthService } from './admin-system-health.service';

describe('AdminSystemHealthService', () => {
  it('reports healthy without emitting an operational warning', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ limit });
    const operationalEvents = { record: vi.fn() };
    const service = new AdminSystemHealthService(
      {
        getClient: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ select }),
        }),
        getRedisClient: vi.fn().mockReturnValue({
          ping: vi.fn().mockResolvedValue('PONG'),
        }),
      } as unknown as SupabaseService,
      operationalEvents as unknown as AdminOperationalEventsService,
    );

    const snapshot = await service.getSnapshot();
    expect(snapshot.state).toBe('healthy');
    expect(snapshot.dependencies).toEqual({
      database: 'healthy',
      redis: 'healthy',
    });
    expect(snapshot.checkedAt).toEqual(expect.any(String));
    expect(operationalEvents.record).not.toHaveBeenCalled();
  });

  it('reports degraded and emits only sanitized dependency state', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('database internal detail'),
    });
    const select = vi.fn().mockReturnValue({ limit });
    const operationalEvents = { record: vi.fn().mockResolvedValue(undefined) };
    const service = new AdminSystemHealthService(
      {
        getClient: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ select }),
        }),
        getRedisClient: vi.fn().mockReturnValue({
          ping: vi.fn().mockRejectedValue(new Error('redis internal detail')),
        }),
      } as unknown as SupabaseService,
      operationalEvents as unknown as AdminOperationalEventsService,
    );

    const snapshot = await service.getSnapshot();
    expect(snapshot.state).toBe('degraded');
    expect(snapshot.dependencies).toEqual({
      database: 'degraded',
      redis: 'degraded',
    });
    expect(JSON.stringify(snapshot)).not.toContain('internal detail');
    expect(operationalEvents.record).toHaveBeenCalledWith({
      severity: 'warning',
      category: 'system-health',
      message: 'Dependency state degraded: database=degraded, redis=degraded',
      source: 'admin-system-health',
    });
  });
});
