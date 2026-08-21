import { SupabaseService } from '../supabase/supabase.service';
import { AdminOperationalEventsService } from './admin-operational-events.service';

describe('AdminOperationalEventsService', () => {
  it('writes only bounded structured operational fields', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const service = new AdminOperationalEventsService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await service.record({
      severity: 'warning',
      category: ' system-health ',
      message: ' dependency state degraded ',
      correlationId: ' request-1 ',
      source: ' admin-v1 ',
    });

    expect(from).toHaveBeenCalledWith('admin_operational_events');
    expect(insert).toHaveBeenCalledWith({
      severity: 'warning',
      category: 'system-health',
      message: 'dependency state degraded',
      correlation_id: 'request-1',
      source: 'admin-v1',
    });
  });

  it('rejects empty category or message before persistence', async () => {
    const insert = vi.fn();
    const service = new AdminOperationalEventsService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ insert }),
      }),
    } as unknown as SupabaseService);

    await expect(
      service.record({ severity: 'error', category: ' ', message: 'failure' }),
    ).rejects.toThrow('Operational event category and message are required');
    expect(insert).not.toHaveBeenCalled();
  });

  it('returns bounded newest-first operational events with exact and time filters', async () => {
    const range = vi
      .fn()
      .mockResolvedValue({ data: [], error: null, count: 0 });
    const order = vi.fn().mockReturnValue({ range });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte });
    const eqCorrelation = vi.fn().mockReturnValue({ gte });
    const eqSource = vi.fn().mockReturnValue({ eq: eqCorrelation });
    const eqCategory = vi.fn().mockReturnValue({ eq: eqSource });
    const eqSeverity = vi.fn().mockReturnValue({ eq: eqCategory });
    const select = vi.fn().mockReturnValue({ eq: eqSeverity });
    const from = vi.fn().mockReturnValue({ select });
    const service = new AdminOperationalEventsService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(
      service.list({
        page: 2,
        pageSize: 25,
        severity: 'error',
        category: 'database',
        source: 'admin-v1',
        correlationId: 'request-1',
        startTime: '2026-08-15T20:00:00.000Z',
        endTime: '2026-08-15T21:00:00.000Z',
      }),
    ).resolves.toEqual({ events: [], total: 0, page: 2, pageSize: 25 });

    expect(from).toHaveBeenCalledWith('admin_operational_events');
    expect(eqSeverity).toHaveBeenCalledWith('severity', 'error');
    expect(eqCategory).toHaveBeenCalledWith('category', 'database');
    expect(eqSource).toHaveBeenCalledWith('source', 'admin-v1');
    expect(eqCorrelation).toHaveBeenCalledWith('correlation_id', 'request-1');
    expect(gte).toHaveBeenCalledWith('created_at', '2026-08-15T20:00:00.000Z');
    expect(lte).toHaveBeenCalledWith('created_at', '2026-08-15T21:00:00.000Z');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(range).toHaveBeenCalledWith(25, 49);
  });

  it('rejects an inverted time window before querying storage', async () => {
    const from = vi.fn();
    const service = new AdminOperationalEventsService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(
      service.list({
        page: 1,
        pageSize: 25,
        startTime: '2026-08-15T22:00:00.000Z',
        endTime: '2026-08-15T21:00:00.000Z',
      }),
    ).rejects.toThrow('startTime must be before or equal to endTime');
    expect(from).not.toHaveBeenCalled();
  });

  it('propagates storage failures', async () => {
    const error = new Error('operational event store unavailable');
    const range = vi.fn().mockResolvedValue({ data: null, error, count: null });
    const order = vi.fn().mockReturnValue({ range });
    const select = vi.fn().mockReturnValue({ order });
    const service = new AdminOperationalEventsService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
    } as unknown as SupabaseService);

    await expect(service.list({ page: 1, pageSize: 25 })).rejects.toBe(error);
  });
});
