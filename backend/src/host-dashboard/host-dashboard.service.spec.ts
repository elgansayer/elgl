import { ForbiddenException } from '@nestjs/common';
import { HostDashboardService } from './host-dashboard.service';
import { SupabaseService } from '../supabase/supabase.service';

describe('HostDashboardService', () => {
  const roomId = 'room-1';
  const hostId = 'host-1';
  const createdAt = '2026-08-29T12:00:00.000Z';

  function createService({
    room = {
      participants_count: 7,
      created_at: createdAt,
      host_id: hostId,
    },
    roomError = null,
    earnings = [{ earned_coins: 35 }],
    earningsError = null,
  }: {
    room?: {
      participants_count: number | null;
      created_at: string | null;
      host_id: string;
    };
    roomError?: { message: string } | null;
    earnings?: unknown;
    earningsError?: { message: string } | null;
  } = {}) {
    const roomQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: room, error: roomError }),
    };
    const client = {
      from: vi.fn().mockReturnValue(roomQuery),
      rpc: vi.fn().mockResolvedValue({ data: earnings, error: earningsError }),
    };
    const supabaseService = {
      getClient: vi.fn().mockReturnValue(client),
    } as unknown as SupabaseService;

    return {
      service: new HostDashboardService(supabaseService),
      client,
      roomQuery,
    };
  }

  it('returns persisted room statistics and host gift earnings', async () => {
    const { service, client, roomQuery } = createService();

    await expect(service.getStats(roomId, hostId)).resolves.toEqual({
      roomId,
      viewerCount: 7,
      earnedCoins: 35,
      startTime: new Date(createdAt),
    });
    expect(client.from).toHaveBeenCalledWith('audio_rooms');
    expect(roomQuery.select).toHaveBeenCalledWith(
      'participants_count, created_at, host_id',
    );
    expect(client.rpc).toHaveBeenCalledWith('get_host_dashboard_earnings', {
      p_room_id: roomId,
      p_host_id: hostId,
    });
  });

  it('rejects an authenticated user who is not the room host', async () => {
    const { service, client } = createService();

    await expect(service.getStats(roomId, 'different-user')).rejects.toThrow(
      ForbiddenException,
    );
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('returns zero earned coins when the aggregate is empty', async () => {
    const { service } = createService({ earnings: [] });

    const result = await service.getStats(roomId, hostId);

    expect(result.earnedCoins).toBe(0);
  });

  it('accepts a safe bigint aggregate serialized as a string', async () => {
    const { service } = createService({
      earnings: [{ earned_coins: '9007199254740991' }],
    });

    const result = await service.getStats(roomId, hostId);

    expect(result.earnedCoins).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('fails closed when the aggregate is unsafe or malformed', async () => {
    const { service } = createService({
      earnings: [{ earned_coins: '9007199254740992' }],
    });

    const result = await service.getStats(roomId, hostId);

    expect(result.earnedCoins).toBe(0);
  });

  it('returns zeroed statistics when the room lookup fails', async () => {
    const { service, client } = createService({
      roomError: { message: 'room unavailable' },
    });

    const result = await service.getStats(roomId, hostId);

    expect(result).toMatchObject({
      roomId,
      viewerCount: 0,
      earnedCoins: 0,
    });
    expect(result.startTime).toBeInstanceOf(Date);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('fails closed to zero earned coins when the aggregate fails', async () => {
    const { service } = createService({
      earningsError: { message: 'earnings unavailable' },
    });

    const result = await service.getStats(roomId, hostId);

    expect(result).toEqual({
      roomId,
      viewerCount: 7,
      earnedCoins: 0,
      startTime: new Date(createdAt),
    });
  });
});
