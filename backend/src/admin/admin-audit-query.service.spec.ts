import { SupabaseService } from '../supabase/supabase.service';
import { AdminAuditQueryService } from './admin-audit-query.service';

describe('AdminAuditQueryService', () => {
  it('returns newest-first bounded audit results with time bounds', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [{ id: 'event-1', action: 'users.login_history.read' }],
      error: null,
      count: 1,
    });
    const order = vi.fn().mockReturnValue({ range });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte });
    const eq = vi.fn().mockReturnValue({ gte });
    const select = vi.fn().mockReturnValue({ eq, gte, order });
    const from = vi.fn().mockReturnValue({ select });
    const service = new AdminAuditQueryService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(
      service.list({
        page: 1,
        pageSize: 50,
        action: 'users.login_history.read',
        startTime: '2026-08-15T20:00:00.000Z',
        endTime: '2026-08-15T21:00:00.000Z',
      }),
    ).resolves.toEqual({
      events: [{ id: 'event-1', action: 'users.login_history.read' }],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    expect(eq).toHaveBeenCalledWith('action', 'users.login_history.read');
    expect(gte).toHaveBeenCalledWith('created_at', '2026-08-15T20:00:00.000Z');
    expect(lte).toHaveBeenCalledWith('created_at', '2026-08-15T21:00:00.000Z');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(range).toHaveBeenCalledWith(0, 49);
  });

  it('filters audit events by exact outcome', async () => {
    const range = vi
      .fn()
      .mockResolvedValue({ data: [], error: null, count: 0 });
    const order = vi.fn().mockReturnValue({ range });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq, order });
    const service = new AdminAuditQueryService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
    } as unknown as SupabaseService);

    await service.list({ outcome: 'failed' });
    expect(eq).toHaveBeenCalledWith('outcome', 'failed');
  });

  it('filters audit events by exact capability key', async () => {
    const range = vi
      .fn()
      .mockResolvedValue({ data: [], error: null, count: 0 });
    const order = vi.fn().mockReturnValue({ range });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq, order });
    const service = new AdminAuditQueryService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
    } as unknown as SupabaseService);

    await service.list({ capabilityKey: 'users.read' });
    expect(eq).toHaveBeenCalledWith('capability_key', 'users.read');
  });

  it('filters audit events by exact reason code', async () => {
    const range = vi
      .fn()
      .mockResolvedValue({ data: [], error: null, count: 0 });
    const order = vi.fn().mockReturnValue({ range });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq, order });
    const service = new AdminAuditQueryService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
    } as unknown as SupabaseService);

    await service.list({ reasonCode: 'policy_violation' });
    expect(eq).toHaveBeenCalledWith('reason_code', 'policy_violation');
  });

  it('rejects inverted time bounds before querying storage', async () => {
    const from = vi.fn();
    const service = new AdminAuditQueryService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(
      service.list({
        startTime: '2026-08-15T22:00:00.000Z',
        endTime: '2026-08-15T21:00:00.000Z',
      }),
    ).rejects.toThrow('startTime must be before or equal to endTime');
    expect(from).not.toHaveBeenCalled();
  });

  it('fails closed when the audit query fails', async () => {
    const error = new Error('audit query unavailable');
    const range = vi.fn().mockResolvedValue({ data: null, error, count: null });
    const order = vi.fn().mockReturnValue({ range });
    const select = vi.fn().mockReturnValue({ order });
    const service = new AdminAuditQueryService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
    } as unknown as SupabaseService);

    await expect(service.list({})).rejects.toBe(error);
  });
});
