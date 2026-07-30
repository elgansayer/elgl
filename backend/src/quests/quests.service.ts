import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class QuestsService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly usersService: UsersService,
  ) {}

  async getDailyQuests(userId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();

    // return existing active quests or create default ones
    const { data } = await supabase
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (data && data.length > 0) {
      return this.evaluateReset(userId, data);
    }

    await this.ensureDefaults(userId);
    const { data: newData } = await supabase
      .from('user_quests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    return (newData ?? []).map((q: any) => ({
      ...q,
      progress: q.progress ?? 0,
    }));
  }

  private async evaluateReset(userId: string, quests: any[]): Promise<any[]> {
    const now = new Date();
    const supabase = this.supabaseService.getClient();

    for (const q of quests) {
      const lastReset = new Date(q.updated_at);
      const diffHours = (now.getTime() - lastReset.getTime()) / 3600000;
      if (q.quest_type === 'daily' && diffHours >= 24) {
        await supabase
          .from('user_quests')
          .update({
            progress: 0,
            completed: false,
            updated_at: now.toISOString(),
          })
          .eq('id', q.id)
          .eq('user_id', userId);
      } else if (q.quest_type === 'weekly' && diffHours >= 168) {
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
    return (data ?? []).map((q: any) => ({ ...q, progress: q.progress ?? 0 }));
  }

  private async ensureDefaults(userId: string): Promise<void> {
    const defaultQuests = [
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
    for (const q of defaultQuests) {
      const { data } = await supabase
        .from('user_quests')
        .select('id')
        .eq('user_id', userId)
        .eq('quest_type', q.quest_type)
        .eq('quest_key', q.quest_key)
        .maybeSingle();
      if (!data) {
        await supabase.from('user_quests').insert({
          user_id: userId,
          quest_type: q.quest_type,
          quest_key: q.quest_key,
          progress: 0,
          target: q.target,
          reward_coins: q.reward_coins,
          completed: false,
          updated_at: new Date().toISOString(),
        });
      }
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

    for (const quest of data) {
      const newProgress = (quest.progress ?? 0) + amount;
      const completed = newProgress >= quest.target;
      const updatePayload: any = {
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
    }
  }
}
