import { DataScrubbingService } from '../privacy/data-scrubbing.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminLoginHistoryQueryService } from './admin-login-history-query.service';

describe('AdminLoginHistoryQueryService', () => {
  it('returns at most 50 newest entries after privacy scrubbing', async () => {
    const rows = [
      {
        id: 'history-1',
        user_id: 'user-1',
        ip_address: '203.0.113.25',
        user_agent: 'Browser',
        created_at: '2026-08-15T20:00:00.000Z',
      },
    ];
    const limit = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const scrubLoginHistory = vi.fn((entries: typeof rows) => {
      entries[0].ip_address = '203.0.113.0';
    });
    const service = new AdminLoginHistoryQueryService(
      {
        getClient: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ select }),
        }),
      } as unknown as SupabaseService,
      { scrubLoginHistory } as unknown as DataScrubbingService,
    );

    await expect(service.list('user-1')).resolves.toEqual([
      expect.objectContaining({ ip_address: '203.0.113.0' }),
    ]);
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(50);
    expect(scrubLoginHistory).toHaveBeenCalledWith(rows);
  });

  it('propagates storage failures instead of presenting a false empty history', async () => {
    const error = new Error('login history unavailable');
    const limit = vi.fn().mockResolvedValue({ data: null, error });
    const order = vi.fn().mockReturnValue({ limit });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const scrubLoginHistory = vi.fn();
    const service = new AdminLoginHistoryQueryService(
      {
        getClient: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({ select }),
        }),
      } as unknown as SupabaseService,
      { scrubLoginHistory } as unknown as DataScrubbingService,
    );

    await expect(service.list('user-1')).rejects.toBe(error);
    expect(scrubLoginHistory).not.toHaveBeenCalled();
  });
});
