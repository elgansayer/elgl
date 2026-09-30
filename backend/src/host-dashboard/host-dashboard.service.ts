import { ForbiddenException, Injectable } from '@nestjs/common';
import { HostDashboardStatsDto } from './dto/host-dashboard.dto';
import { SupabaseService } from '../supabase/supabase.service';

function firstResultRow(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  const rows: unknown[] = data;
  return rows[0];
}

function parseEarnedCoins(data: unknown): number {
  const row = firstResultRow(data);
  if (typeof row !== 'object' || row === null || !('earned_coins' in row)) {
    return 0;
  }

  const value = row.earned_coins;
  const coins =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^\d+$/.test(value)
        ? Number(value)
        : Number.NaN;

  return Number.isSafeInteger(coins) && coins >= 0 ? coins : 0;
}

@Injectable()
export class HostDashboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getStats(
    roomId: string,
    requesterId: string,
  ): Promise<HostDashboardStatsDto> {
    const supabase = this.supabaseService.getClient();

    // Include ownership in the authoritative room lookup so dashboard metrics
    // are never disclosed to arbitrary authenticated users.
    const { data: room, error } = await supabase
      .from('audio_rooms')
      .select('participants_count, created_at, host_id')
      .eq('id', roomId)
      .single();

    if (error || !room) {
      // Fail gracefully with zero-ed stats
      return {
        roomId,
        viewerCount: 0,
        earnedCoins: 0,
        startTime: new Date(),
      };
    }

    if (room.host_id !== requesterId) {
      throw new ForbiddenException();
    }

    // Aggregate in Postgres instead of materialising an unbounded room gift
    // history in the backend. The RPC also scopes gifts to the room host.
    let earnedCoins = 0;
    try {
      const { data: earnings, error: earningsError } = await supabase.rpc(
        'get_host_dashboard_earnings',
        {
          p_room_id: roomId,
          p_host_id: room.host_id,
        },
      );
      if (!earningsError) earnedCoins = parseEarnedCoins(earnings);
    } catch {
      // Earnings are supplementary. Preserve room statistics and fail closed
      // when the provider rejects instead of leaking its error or failing 500.
    }

    return {
      roomId,
      viewerCount: room.participants_count ?? 0,
      earnedCoins,
      startTime: room.created_at ? new Date(room.created_at) : new Date(),
    };
  }
}
