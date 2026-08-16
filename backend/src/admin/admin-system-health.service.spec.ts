import { SupabaseService } from '../supabase/supabase.service';
import { AdminOperationalEventsService } from './admin-operational-events.service';
import { AdminSystemHealthService } from './admin-system-health.service';

describe('AdminSystemHealthService', () => {
  it('reports healthy with bounded dependency latency and no operational warning', async () => {
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
    expect(snapshot.dependencyLatencyMs).toEqual({
      database: expect.any(Number),
      redis: expect.any(Number),
    });
    expect(snapshot.dependencyLatencyMs.database).toBeGreaterThanOrEqual(0);
    expect(snapshot.dependencyLatencyMs.redis).toBeGreaterThanOrEqual(0);
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
    expect(snapshot.dependencyLatencyMs).toEqual({
      database: expect.any(Number),
      redis: expect.any(Number),
    });
    expect(JSON.stringify(snapshot)).not.toContain('internal detail');
    expect(operationalEvents.record).toHaveBeenCalledWith({
      severity: 'warning',
      category: 'system-health',
      message: 'Dependency state degraded: database=degraded, redis=degraded',
      source: 'admin-system-health',
    });
  });

  it('times out a hung dependency instead of hanging the health snapshot', async () => {
    vi.useFakeTimers();
    try {
      const limit = vi.fn().mockResolvedValue({ data: [], error: null });
      const select = vi.fn().mockReturnValue({ limit });
      const operationalEvents = {
        record: vi.fn().mockResolvedValue(undefined),
      };
      const service = new AdminSystemHealthService(
        {
          getClient: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({ select }),
          }),
          getRedisClient: vi.fn().mockReturnValue({
            ping: vi.fn().mockReturnValue(new Promise<string>(() => undefined)),
          }),
        } as unknown as SupabaseService,
        operationalEvents as unknown as AdminOperationalEventsService,
      );

      const snapshotPromise = service.getSnapshot();
      await vi.advanceTimersByTimeAsync(2_000);

      await expect(snapshotPromise).resolves.toMatchObject({
        state: 'degraded',
        dependencies: { database: 'healthy', redis: 'degraded' },
      });
      expect(operationalEvents.record).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it('still returns the degraded snapshot when operational-event storage fails', async () => {
    const limit = vi
      .fn()
      .mockResolvedValue({ data: null, error: new Error('down') });
    const select = vi.fn().mockReturnValue({ limit });
    const operationalEvents = {
      record: vi.fn().mockRejectedValue(new Error('event store unavailable')),
    };
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

    await expect(service.getSnapshot()).resolves.toMatchObject({
      state: 'degraded',
      dependencies: {
        database: 'degraded',
        redis: 'healthy',
      },
      dependencyLatencyMs: {
        database: expect.any(Number),
        redis: expect.any(Number),
      },
    });
    expect(operationalEvents.record).toHaveBeenCalledOnce();
  });
});
