import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

<<<<<<< HEAD
export interface MyStatsResponse {
  study_hours: number;
  messages_sent: number;
  corrections_made: number;
  weekly_study_hours: { day: string; hours: number }[];
  activity_breakdown: { label: string; count: number }[];
=======
interface StudyHoursRow {
  day: string;
  total_seconds: number;
}

export interface MyStatsResponse {
  study_hours: { day: string; hours: number }[];
  messages_sent: number;
  corrections_count: number;
  moments_count: number;
>>>>>>> origin/main
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

<<<<<<< HEAD
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // messages sent count
    const { count: messagesSent, error: msgErr } = await client
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender_id', userId);
    if (msgErr) throw new Error(msgErr.message);
=======
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
    for (const log of (callLogs as { duration_seconds: number; started_at: string }[]) ?? []) {
      const dayIdx = new Date(log.started_at).getDay();
      const day = dayNames[dayIdx];
      dailySeconds[day] = (dailySeconds[day] ?? 0) + (log.duration_seconds ?? 0);
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
>>>>>>> origin/main

    // corrections made: correction_payload in chat_messages + moment_comments
    const [
      { count: chatCorrections, error: chatCorrErr },
      { count: momentCorrections, error: momentCorrErr },
    ] = await Promise.all([
      client
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', userId)
        .not('correction_payload', 'is', null),
      client
        .from('moment_comments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('correction_payload', 'is', null),
    ]);
    if (chatCorrErr) throw new Error(chatCorrErr.message);
    if (momentCorrErr) throw new Error(momentCorrErr.message);
    const correctionsMade = (chatCorrections ?? 0) + (momentCorrections ?? 0);

<<<<<<< HEAD
    // study hours: approximate by counting distinct hours with messages this week
    const { data: weeklyMessages, error: weeklyErr } = await client
      .from('chat_messages')
      .select('created_at')
      .eq('sender_id', userId)
      .gte('created_at', weekAgo.toISOString())
      .order('created_at', { ascending: true });
    if (weeklyErr) throw new Error(weeklyErr.message);

    const studyHours = this.calculateStudyHours(weeklyMessages ?? []);
    const weeklyStudyHours = this.buildWeeklyChart(weeklyMessages ?? [], now);
    const activityBreakdown = this.buildActivityBreakdown(messagesSent ?? 0, correctionsMade);

    return {
      study_hours: studyHours,
      messages_sent: messagesSent ?? 0,
      corrections_made: correctionsMade,
      weekly_study_hours: weeklyStudyHours,
      activity_breakdown: activityBreakdown,
=======
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
>>>>>>> origin/main
    };
  }

  private calculateStudyHours(
    messages: { created_at: string }[],
  ): number {
    if (messages.length === 0) return 0;
    const distinctHours = new Set<string>();
    for (const msg of messages) {
      const d = new Date(msg.created_at);
      distinctHours.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`);
    }
    return distinctHours.size;
  }

  private buildWeeklyChart(
    messages: { created_at: string }[],
    now: Date,
  ): { day: string; hours: number }[] {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyMap = new Map<string, Set<string>>();
    for (const day of dayNames) {
      weeklyMap.set(day, new Set());
    }
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    for (const msg of messages) {
      const d = new Date(msg.created_at);
      if (d >= weekStart) {
        const dayName = dayNames[d.getDay()];
        const hourKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
        weeklyMap.get(dayName)?.add(hourKey);
      }
    }
    return dayNames.map((day) => ({
      day,
      hours: weeklyMap.get(day)?.size ?? 0,
    }));
  }

  private buildActivityBreakdown(
    messagesSent: number,
    correctionsMade: number,
  ): { label: string; count: number }[] {
    return [
      { label: 'Messages Sent', count: messagesSent },
      { label: 'Corrections Made', count: correctionsMade },
    ];
  }
}
