import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { FullAchievementDto } from './dto/full-achievement.dto';
import { AchievementDto } from './dto/achievement.dto';
import { UserAchievementDto } from './dto/user-achievement.dto';

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

  private readonly messageMilestoneCodes: readonly string[] = [
    'first_message',
    '100_messages',
    '500_messages',
  ];

  private readonly streakMilestoneCodes: readonly string[] = [
    '7_day_streak',
    '30_day_streak',
  ];

  constructor(private readonly supabaseService: SupabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.seedAchievements();
    this.logger.log('Achievements seeded (if missing)');
  }

  private async seedAchievements(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const achievements = this.milestones.map((milestone) => ({
      code: milestone.code,
      name: milestone.name,
      description: milestone.description,
    }));
    const { error } = await supabase
      .from('achievements')
      .upsert(achievements, { onConflict: 'code' });

    if (error) {
      this.logger.warn(`Failed to bulk upsert achievements: ${error.message}`);
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

  async listAchievements(): Promise<AchievementDto[]> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('achievements')
      .select('*')
      .returns<AchievementDto[]>();
    return data ?? [];
  }

  async getUserAchievements(userId: string): Promise<UserAchievementDto[]> {
    const supabase = this.supabaseService.getClient();
    const { data } = await supabase
      .from('user_achievements')
      .select('achievements(*)')
      .eq('user_id', userId)
      .returns<UserAchievementDto[]>();
    return data ?? [];
  }

  async getFullAchievements(userId: string): Promise<FullAchievementDto[]> {
    const supabase = this.supabaseService.getClient();

    const { data: definitions } = await supabase
      .from('achievements')
      .select('code, name, description')
      .order('code', { ascending: true })
      .returns<Pick<AchievementDto, 'code' | 'name' | 'description'>[]>();
    if (!definitions) {
      return [];
    }

    // ⚡ Bolt Optimization: Group independent database lookups with a single concurrent Promise.all batch fetch to mitigate additive network latency.
    const [earnedRows, msgCount, streakDays] = await Promise.all([
      this.getUserAchievements(userId),
      this.getUserMessageCount(userId),
      this.getStudyStreakDays(userId),
    ]);

    // get already earned codes
    const earnedCodes = new Set<string>();
    for (const row of earnedRows) {
      const code = row.achievements?.code;
      if (code) earnedCodes.add(code);
    }

    const thresholds: Record<string, { required: number }> = {
      first_message: { required: 1 },
      '100_messages': { required: 100 },
      '500_messages': { required: 500 },
      '7_day_streak': { required: 7 },
      '30_day_streak': { required: 30 },
    };

    return definitions.map((def) => {
      let current = 0;
      const threshold = thresholds[def.code];
      if (threshold) {
        if (
          def.code === 'first_message' ||
          def.code === '100_messages' ||
          def.code === '500_messages'
        ) {
          current = msgCount;
        } else if (
          def.code === '7_day_streak' ||
          def.code === '30_day_streak'
        ) {
          current = streakDays;
        }
      }
      return {
        code: def.code,
        name: def.name,
        description: def.description ?? '',
        current,
        required: threshold?.required ?? 0,
        earned: earnedCodes.has(def.code),
      };
    });
  }

  async evaluateAchievements(userId: string): Promise<void> {
    // The earned-state lookup is bounded by the small achievement catalogue. Once a
    // milestone family is complete, skip its potentially growing source query on
    // every subsequent event. This keeps message.sent cheap for long-lived users.
    const earnedRows = await this.getUserAchievements(userId);
    const earnedCodes = new Set<string>();
    for (const row of earnedRows) {
      const code = row.achievements?.code;
      if (code) earnedCodes.add(code);
    }

    const messageMilestonesComplete = this.messageMilestoneCodes.every((code) =>
      earnedCodes.has(code),
    );
    const streakMilestonesComplete = this.streakMilestoneCodes.every((code) =>
      earnedCodes.has(code),
    );

    const [msgCount, streakDays] = await Promise.all([
      messageMilestonesComplete
        ? Promise.resolve(0)
        : this.getUserMessageCount(userId),
      streakMilestonesComplete
        ? Promise.resolve(0)
        : this.getStudyStreakDays(userId),
    ]);

    const newAwards: Promise<void>[] = [];

    // Award milestones based on thresholds
    if (msgCount >= 1 && !earnedCodes.has('first_message')) {
      newAwards.push(this.awardAchievement(userId, 'first_message'));
    }
    if (msgCount >= 100 && !earnedCodes.has('100_messages')) {
      newAwards.push(this.awardAchievement(userId, '100_messages'));
    }
    if (msgCount >= 500 && !earnedCodes.has('500_messages')) {
      newAwards.push(this.awardAchievement(userId, '500_messages'));
    }
    if (streakDays >= 7 && !earnedCodes.has('7_day_streak')) {
      newAwards.push(this.awardAchievement(userId, '7_day_streak'));
    }
    if (streakDays >= 30 && !earnedCodes.has('30_day_streak')) {
      newAwards.push(this.awardAchievement(userId, '30_day_streak'));
    }

    if (newAwards.length > 0) {
      await Promise.all(newAwards);
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
      .single<{ study_streak_days: number | null }>();
    if (error || !data) {
      return 0;
    }
    return data.study_streak_days ?? 0;
  }
}
