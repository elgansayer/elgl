import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class StudyStreakService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getStreak(userId: string): Promise<number> {
    const client = this.supabaseService.getClient();
    const result = await client
      .from('users')
      .select('study_streak_days')
      .eq('id', userId)
      .single();

    const data = result.data as Record<string, unknown> | null;
    const { error } = result;

    if (error) {
      // If the user row is missing, treat streak as 0 rather than throwing
      if (error.code === 'PGRST116') {
        return 0;
      }
      throw new Error(`Failed to fetch streak: ${error.message}`);
    }
    return (data?.study_streak_days as number) ?? 0;
  }

  async updateStreak(userId: string): Promise<number> {
    const client = this.supabaseService.getClient();
    const now = new Date();
    const { data, error } = await client
      .from('users')
      .select('study_streak_days, last_active_at')
      .eq('id', userId)
      .single();

    if (error) {
      // If row is missing, initialise streak to 1 using upsert
      if (error.code === 'PGRST116') {
        const { error: upsertError } = await client.from('users').upsert(
          {
            id: userId,
            study_streak_days: 1,
            last_active_at: now.toISOString(),
          },
          { onConflict: 'id' },
        );
        if (upsertError) {
          throw new Error(
            `Failed to create initial streak entry: ${upsertError.message}`,
          );
        }
        this.eventEmitter.emit('achievements.evaluate', { userId });
        return 1;
      }
      throw new Error(
        `Failed to fetch user for streak update: ${error.message}`,
      );
    }

    const raw = data as Record<string, unknown>;
    const today = now.toDateString();

    const lastActive = raw?.last_active_at
      ? new Date(raw.last_active_at as string)
      : null;
    const lastActiveDate = lastActive ? lastActive.toDateString() : null;

    const currentStreak = (raw?.study_streak_days as number) ?? 0;
    let newStreak: number;
    if (lastActiveDate === today) {
      // Already checked in today, keep streak unchanged
      newStreak = currentStreak;
    } else if (
      lastActiveDate === new Date(now.getTime() - 86400000).toDateString()
    ) {
      // Yesterday, increment streak
      newStreak = currentStreak + 1;
    } else {
      // More than one day gap, reset to 1
      newStreak = 1;
    }

    const { error: updateError } = await client
      .from('users')
      .update({
        study_streak_days: newStreak,
        last_active_at: now.toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      throw new Error(`Failed to update streak: ${updateError.message}`);
    }

    this.eventEmitter.emit('achievements.evaluate', { userId });
    return newStreak;
  }
}
