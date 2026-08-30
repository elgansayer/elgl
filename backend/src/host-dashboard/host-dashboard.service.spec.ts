import { HostDashboardService } from './host-dashboard.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('HostDashboardService', () => {
  it('does not fabricate earnings when no gift-ledger aggregate exists', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        participants_count: 7,
        created_at: '2026-08-30T12:00:00.000Z',
      },
      error: null,
    });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single,
    };
    const supabaseService = {
      getClient: () => ({
        from: vi.fn().mockReturnValue(query),
      }),
    } as unknown as SupabaseService;
    const service = new HostDashboardService(supabaseService);

    await expect(service.getStats('room-1')).resolves.toEqual({
      roomId: 'room-1',
      viewerCount: 7,
      earnedCoins: 0,
      startTime: new Date('2026-08-30T12:00:00.000Z'),
    });
  });
});
