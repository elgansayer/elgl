import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  // Define milestone checks
  private readonly milestones = [
    {
      code: 'first_message',
      name: 'First Message',
      description: 'Send your first message in a chat.',
    },
    {
      code: '100_messages',
      name: '100 Messages',
      description: 'Send 100 messages in chats.',
    },
    {
      code: '500_messages',
      name: '500 Messages',
      description: 'Send 500 messages in chats.',
    },
    {
      code: '7_day_streak',
      name: '7-Day Streak',
      description: 'Keep a 7‑day study streak.',
    },
    {
      code: '30_day_streak',
      name: '30-Day Streak',
      description: 'Keep a 30‑day study streak.',
    },
  ];

  constructor(private readonly supabaseService: SupabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.seedAchievements();
    this.logger.log('Achievements seeded (if missing)');
  }

  private async seedAchievements(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    for (const m of this.milestones) {
      const { error } = await supabase
        .from('achievements')
        .upsert(
          { code: m.code, name: m.name, description: m.description },
          { onConflict: 'code' },
        );
      if (error) {
        this.logger.warn(
          `Failed to upsert achievement ${m.code}: ${error.message}`,
        );
      }
    }
  }

  async awardAchievement(
    userId: string,
    achievementCode: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Look up achievement id
    const { data: ach } = await supabase
      .from('achievements')
      .select('id')
      .eq('code', achievementCode)
      .single();
    if (!ach) {
      this.logger.warn(`Achievement code "${achievementCode}" not found.`);
      return;
    }

    // Insert user_achievement (ignore duplicate)
    const { error } = await supabase
      .from('user_achievements')
      .upsert(
        { user_id: userId, achievement_id: ach.id },
        { onConflict: 'user_id,achievement_id' },
      );
    if (error) {
      this.logger.error(
        `Failed to award achievement ${achievementCode} to ${userId}: ${error.message}`,
      );
    }
  }

  async hasAchievement(
    userId: string,
    achievementCode: string,
  ): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    const { data: ach } = await supabase
      .from('achievements')
      .select('id')
      .eq('code', achievementCode)
      .single();
    if (!ach) return false;
    const { data } = await supabase
      .from('user_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_id', ach.id)
      .single();
    return !!data;
  }

  async listAchievements(): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase.from('achievements').select('*');
    return data ?? [];
  }

  async getUserAchievements(userId: string): Promise<any[]> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('user_achievements')
      .select('achievements(*)')
      .eq('user_id', userId);
    return data ?? [];
  }

  async evaluateAchievements(userId: string): Promise<void> {
    const supabase = this.supabaseService.getClient();

    // Message count
    const msgCount = await this.getUserMessageCount(userId);

    // Study streak
    const streakDays = await this.getStudyStreakDays(userId);

    // Award milestones based on thresholds
    if (
      msgCount >= 1 &&
      !(await this.hasAchievement(userId, 'first_message'))
    ) {
      await this.awardAchievement(userId, 'first_message');
    }
    if (
      msgCount >= 100 &&
      !(await this.hasAchievement(userId, '100_messages'))
    ) {
      await this.awardAchievement(userId, '100_messages');
    }
    if (
      msgCount >= 500 &&
      !(await this.hasAchievement(userId, '500_messages'))
    ) {
      await this.awardAchievement(userId, '500_messages');
    }
    if (
      streakDays >= 7 &&
      !(await this.hasAchievement(userId, '7_day_streak'))
    ) {
      await this.awardAchievement(userId, '7_day_streak');
    }
    if (
      streakDays >= 30 &&
      !(await this.hasAchievement(userId, '30_day_streak'))
    ) {
      await this.awardAchievement(userId, '30_day_streak');
    }
  }

  @OnEvent('achievements.evaluate')
  async handleEvaluationEvent(payload: { userId: string }): Promise<void> {
    await this.evaluateAchievements(payload.userId);
  }

  @OnEvent('message.sent')
  async handleMessageSent(payload: { userId: string }): Promise<void> {
    await this.evaluateAchievements(payload.userId);
  }

  private async getUserMessageCount(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', userId);
    if (error) {
      this.logger.error(
        `Failed to get message count for user ${userId}: ${error.message}`,
      );
      return 0;
    }
    return count ?? 0;
  }

  private async getStudyStreakDays(userId: string): Promise<number> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('users')
      .select('study_streak_days')
      .eq('id', userId)
      .single();
    if (error || !data) {
      return 0;
    }
    return data.study_streak_days ?? 0;
  }
}
