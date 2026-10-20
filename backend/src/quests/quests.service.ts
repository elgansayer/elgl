import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';

export interface Quest {
  id: string;
  user_id: string;
  quest_type: string;
  quest_key: string;
  progress: number;
  target: number;
  reward_coins: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class QuestsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  async getDailyQuests(userId: string): Promise<Quest[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      return this.evaluateReset(userId, data);
    }

    await this.ensureDefaults(userId);
    const { data: newData, error: newError } = await supabase
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (newError) {
      throw newError;
    }

    return (newData ?? []).map((q: Quest) => ({
      ...q,
      progress: q.progress ?? 0,
    }));
  }

  private async evaluateReset(
    userId: string,
    quests: Quest[],
  ): Promise<Quest[]> {
    const now = new Date();
    const supabase = this.supabaseService.getClient();

    for (const q of quests) {
      const lastReset = new Date(q.updated_at);
      const diffHours = (now.getTime() - lastReset.getTime()) / 3600000;
      const shouldReset =
        (q.quest_type === 'daily' && diffHours >= 24) ||
        (q.quest_type === 'weekly' && diffHours >= 168);

      if (shouldReset) {
        await supabase
          .from('user_quests')
          .update({
            progress: 0,
            completed: false,
            updated_at: now.toISOString(),
          })
          .eq('id', q.id)
          .eq('user_id', userId);
      }
    }

    const { data } = await supabase
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    return (data ?? []).map((q: Quest) => ({
      ...q,
      progress: q.progress ?? 0,
    }));
  }

  private async ensureDefaults(userId: string): Promise<void> {
    const defaultQuests: Array<{
      quest_type: string;
      quest_key: string;
      target: number;
      reward_coins: number;
    }> = [
      {
        quest_type: 'daily',
        quest_key: 'correct_moments',
        target: 3,
        reward_coins: 5,
      },
      {
        quest_type: 'daily',
        quest_key: 'post_moment',
        target: 1,
        reward_coins: 5,
      },
      {
        quest_type: 'weekly',
        quest_key: 'correct_moments',
        target: 10,
        reward_coins: 20,
      },
    ];

    const supabase = this.supabaseService.getClient();

    // ⚡ Bolt Optimization: Replace sequential query checks and single row inserts in ensureDefaults
    // with a single bulk fetch using .select followed by calculating differences in memory,
    // culminating in a single bulk .insert().
    const { data: existingQuests } = await supabase
      .from('user_quests')
      .select('quest_type, quest_key')
      .eq('user_id', userId);

    const existingSet = new Set(
      (existingQuests || []).map((q) => `${q.quest_type}:${q.quest_key}`),
    );

    const missingQuests = defaultQuests
      .filter((q) => !existingSet.has(`${q.quest_type}:${q.quest_key}`))
      .map((q) => ({
        user_id: userId,
        quest_type: q.quest_type,
        quest_key: q.quest_key,
        progress: 0,
        target: q.target,
        reward_coins: q.reward_coins,
        completed: false,
        updated_at: new Date().toISOString(),
      }));

    if (missingQuests.length > 0) {
      await supabase.from('user_quests').insert(missingQuests);
    }
  }

  async incrementProgress(
    userId: string,
    questKey: string,
    amount: number,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .eq('quest_key', questKey)
      .neq('completed', true);

    if (!data || data.length === 0) return;

    // ⚡ Bolt Optimization: Replace sequential await loop with Promise.allSettled mapped concurrent operations
    const updatePromises = data.map(async (quest) => {
      const newProgress = (quest.progress ?? 0) + amount;
      const completed = newProgress >= quest.target;
      const updatePayload: {
        progress: number;
        completed: boolean;
        updated_at: string;
      } = {
        progress: completed ? quest.target : newProgress,
        completed,
        updated_at: new Date().toISOString(),
      };
      if (completed) {
        await this.usersService.awardCoins(userId, quest.reward_coins);
      }
      await supabase
        .from('user_quests')
        .update(updatePayload)
        .eq('id', quest.id);
    });

    const results = await Promise.allSettled(updatePromises);
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failures.length > 0) {
      throw failures[0].reason;
    }
  }
}
