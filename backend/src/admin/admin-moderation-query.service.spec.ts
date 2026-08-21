import { SupabaseService } from '../supabase/supabase.service';
import { AdminModerationQueryService } from './admin-moderation-query.service';

describe('AdminModerationQueryService', () => {
  it('applies exact moderation filters and time bounds with newest-first pagination', async () => {
    const range = vi
      .fn()
      .mockResolvedValue({ data: [], error: null, count: 0 });
    const order = vi.fn().mockReturnValue({ range });
    const lte = vi.fn().mockReturnValue({ order });
    const gte = vi.fn().mockReturnValue({ lte });
    const eqReporterUser = vi.fn().mockReturnValue({ gte });
    const eqReportedUser = vi.fn().mockReturnValue({ eq: eqReporterUser });
    const eqReason = vi.fn().mockReturnValue({ eq: eqReportedUser });
    const eqStatus = vi.fn().mockReturnValue({ eq: eqReason });
    const eqReportId = vi.fn().mockReturnValue({ eq: eqStatus });
    const select = vi.fn().mockReturnValue({ eq: eqReportId, gte, order });
    const service = new AdminModerationQueryService({
      getClient: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ select }),
      }),
    } as unknown as SupabaseService);

    await expect(
      service.list({
        page: 2,
        pageSize: 20,
        reportId: ' report-1 ',
        status: ' open ',
        reasonCategory: ' harassment ',
        reportedUserId: ' user-1 ',
        reporterUserId: ' reporter-1 ',
        startTime: '2026-08-15T20:00:00.000Z',
        endTime: '2026-08-15T21:00:00.000Z',
      }),
    ).resolves.toEqual({ reports: [], total: 0, page: 2, pageSize: 20 });

    expect(eqReportId).toHaveBeenCalledWith('id', 'report-1');
    expect(eqStatus).toHaveBeenCalledWith('status', 'open');
    expect(eqReason).toHaveBeenCalledWith('reason_category', 'harassment');
    expect(eqReportedUser).toHaveBeenCalledWith('reported_user_id', 'user-1');
    expect(eqReporterUser).toHaveBeenCalledWith('reporter_id', 'reporter-1');
    expect(gte).toHaveBeenCalledWith('created_at', '2026-08-15T20:00:00.000Z');
    expect(lte).toHaveBeenCalledWith('created_at', '2026-08-15T21:00:00.000Z');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(range).toHaveBeenCalledWith(20, 39);
  });

  it('rejects inverted moderation time bounds before querying storage', async () => {
    const from = vi.fn();
    const service = new AdminModerationQueryService({
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

  it('fails closed when report storage fails', async () => {
    const error = new Error('reports unavailable');
    const range = vi.fn().mockResolvedValue({ data: null, error, count: null });
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
