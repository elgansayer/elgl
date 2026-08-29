import { HostDashboardService } from './host-dashboard.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('HostDashboardService', () => {
  const roomId = 'room-1';
  const createdAt = '2026-08-29T12:00:00.000Z';

  function createService({
    room = { participants_count: 7, created_at: createdAt },
    roomError = null,
    gifts = [{ coins_spent: 10 }, { coins_spent: 25 }],
    giftsError = null,
  }: {
    room?: { participants_count: number | null; created_at: string | null };
    roomError?: { message: string } | null;
    gifts?: Array<{ coins_spent: number }> | null;
    giftsError?: { message: string } | null;
  } = {}) {
    const roomQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: room, error: roomError }),
    };
    const giftsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: gifts, error: giftsError }),
    };
    const client = {
      from: vi.fn((table: string) =>
        table === 'audio_rooms' ? roomQuery : giftsQuery,
      ),
    };
    const supabaseService = {
      getClient: vi.fn().mockReturnValue(client),
    } as unknown as SupabaseService;

    return {
      service: new HostDashboardService(supabaseService),
      client,
      roomQuery,
      giftsQuery,
    };
  }

  it('returns persisted room statistics and sums earned gift coins', async () => {
    const { service, client, giftsQuery } = createService();

    await expect(service.getStats(roomId)).resolves.toEqual({
      roomId,
      viewerCount: 7,
      earnedCoins: 35,
      startTime: new Date(createdAt),
    });
    expect(client.from).toHaveBeenNthCalledWith(1, 'audio_rooms');
    expect(client.from).toHaveBeenNthCalledWith(2, 'gift_transactions');
    expect(giftsQuery.select).toHaveBeenCalledWith('coins_spent');
    expect(giftsQuery.eq).toHaveBeenCalledWith('room_id', roomId);
  });

  it('returns zero earned coins when no gifts exist', async () => {
    const { service } = createService({ gifts: [] });

    const result = await service.getStats(roomId);

    expect(result.earnedCoins).toBe(0);
  });

  it('returns zeroed statistics when the room lookup fails', async () => {
    const { service, client } = createService({
      roomError: { message: 'room unavailable' },
    });

    const result = await service.getStats(roomId);

    expect(result).toMatchObject({
      roomId,
      viewerCount: 0,
      earnedCoins: 0,
    });
    expect(result.startTime).toBeInstanceOf(Date);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it('fails closed to zero earned coins when gift lookup fails', async () => {
    const { service } = createService({
      giftsError: { message: 'gifts unavailable' },
    });

    const result = await service.getStats(roomId);

    expect(result).toEqual({
      roomId,
      viewerCount: 7,
      earnedCoins: 0,
      startTime: new Date(createdAt),
    });
  });
});
