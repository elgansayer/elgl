import * as crypto from 'crypto';
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

    // Earned coins will eventually be calculated from a gift_transactions table
    const earnedCoins = crypto.randomInt(1, 11);

    return {
      roomId,
      viewerCount: room.participants_count ?? 0,
      earnedCoins,
      startTime: room.created_at ? new Date(room.created_at) : new Date(),
    };
  }
}
