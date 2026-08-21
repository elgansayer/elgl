import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface StudyHoursRow {
  day: string;
  total_seconds: number;
}

export interface MyStatsResponse {
  study_hours: { day: string; hours: number }[];
  messages_sent: number;
  corrections_count: number;
  moments_count: number;
}

@Injectable()
export class StatsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getStats(userId: string): Promise<MyStatsResponse> {
    const client = this.supabaseService.getClient();

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // study hours from call_logs this week – sum duration_seconds grouped by day
    const { data: callLogs, error: callErr } = await client
      .from('call_logs')
      .select('duration_seconds, started_at')
      .or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
      .gte('started_at', startOfWeek.toISOString())
      .not('duration_seconds', 'is', null);

    if (callErr) {
      throw new Error(callErr.message);
    }

    const dailySeconds: Record<string, number> = {};
    for (const log of (callLogs as {
      duration_seconds: number;
      started_at: string;
    }[]) ?? []) {
      const dayIdx = new Date(log.started_at).getDay();
      const day = dayNames[dayIdx];
      dailySeconds[day] =
        (dailySeconds[day] ?? 0) + (log.duration_seconds ?? 0);
    }

    const study_hours = dayNames.map((day) => ({
      day,
      hours: Math.round(((dailySeconds[day] ?? 0) / 3600) * 10) / 10,
    }));

    // messages sent count
    const { count: messagesCount, error: msgErr } = await client
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId);
    if (msgErr) {
      throw new Error(msgErr.message);
    }

    // corrections count (moment_comments with non-null correction_payload)
    const { count: correctionsCount, error: corrErr } = await client
      .from('moment_comments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('correction_payload', 'is', null);
    if (corrErr) {
      throw new Error(corrErr.message);
    }

    // moments count
    const { count: momentsCount, error: momentsErr } = await client
      .from('moments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (momentsErr) {
      throw new Error(momentsErr.message);
    }

    return {
      study_hours,
      messages_sent: messagesCount ?? 0,
      corrections_count: correctionsCount ?? 0,
      moments_count: momentsCount ?? 0,
    };
  }
}
