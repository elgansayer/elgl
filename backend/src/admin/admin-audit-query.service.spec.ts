import { SupabaseService } from '../supabase/supabase.service';
import { AdminAuditQueryService } from './admin-audit-query.service';

describe('AdminAuditQueryService', () => {
  it('returns newest-first bounded audit results', async () => {
    const range = vi.fn().mockResolvedValue({
      data: [{ id: 'event-1', action: 'users.login_history.read' }],
      error: null,
      count: 1,
    });
    const order = vi.fn().mockReturnValue({ range });
    const eq = vi.fn().mockReturnThis();
    const select = vi.fn().mockReturnValue({ eq, order });
    const from = vi.fn().mockReturnValue({ select });
    const service = new AdminAuditQueryService({
      getClient: vi.fn().mockReturnValue({ from }),
    } as unknown as SupabaseService);

    await expect(
      service.list({
        page: 1,
        pageSize: 50,
        action: 'users.login_history.read',
      }),
    ).resolves.toEqual({
      events: [{ id: 'event-1', action: 'users.login_history.read' }],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    expect(eq).toHaveBeenCalledWith('action', 'users.login_history.read');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(range).toHaveBeenCalledWith(0, 49);
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
