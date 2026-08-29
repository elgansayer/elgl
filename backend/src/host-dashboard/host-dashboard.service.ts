import { Injectable } from '@nestjs/common';
import { HostDashboardStatsDto } from './dto/host-dashboard.dto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class HostDashboardService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getStats(roomId: string): Promise<HostDashboardStatsDto> {
    const supabase = this.supabaseService.getClient();

    // Fetch real viewer count and creation time from the database
    const { data: room, error } = await supabase
      .from('audio_rooms')
      .select('participants_count, created_at')
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

    const { data: gifts, error: giftsError } = await supabase
      .from('gift_transactions')
      .select('coins_spent')
      .eq('room_id', roomId);

    const earnedCoins = giftsError
      ? 0
      : (gifts ?? []).reduce(
          (total, gift) =>
            total + (Number.isFinite(gift.coins_spent) ? gift.coins_spent : 0),
          0,
        );

    return {
      roomId,
      viewerCount: room.participants_count ?? 0,
      earnedCoins,
      startTime: room.created_at ? new Date(room.created_at) : new Date(),
    };
  }
}
