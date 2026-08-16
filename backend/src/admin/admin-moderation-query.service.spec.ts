import { SupabaseService } from '../supabase/supabase.service';
import { AdminModerationQueryService } from './admin-moderation-query.service';

describe('AdminModerationQueryService', () => {
  it('applies exact status and reason filters with newest-first pagination', async () => {
    const range = vi
      .fn()
      .mockResolvedValue({ data: [], error: null, count: 0 });
    const order = vi.fn().mockReturnValue({ range });
    const eqReason = vi.fn().mockReturnValue({ order });
    const eqStatus = vi.fn().mockReturnValue({ eq: eqReason });
    const select = vi.fn().mockReturnValue({ eq: eqStatus, order });
    const service = new AdminModerationQueryService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
    } as unknown as SupabaseService);

    await expect(
      service.list({
        page: 2,
        pageSize: 20,
        status: ' open ',
        reasonCategory: ' harassment ',
      }),
    ).resolves.toEqual({ reports: [], total: 0, page: 2, pageSize: 20 });

    expect(eqStatus).toHaveBeenCalledWith('status', 'open');
    expect(eqReason).toHaveBeenCalledWith('reason_category', 'harassment');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(range).toHaveBeenCalledWith(20, 39);
  });

  it('fails closed when report storage fails', async () => {
    const error = new Error('reports unavailable');
    const range = vi
      .fn()
      .mockResolvedValue({ data: null, error, count: null });
    const order = vi.fn().mockReturnValue({ range });
    const select = vi.fn().mockReturnValue({ order });
    const service = new AdminModerationQueryService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
    } as unknown as SupabaseService);

    await expect(service.list({})).rejects.toBe(error);
  });
});
