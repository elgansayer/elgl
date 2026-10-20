import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupabaseService } from '../supabase/supabase.service';
import { FullAchievementDto } from './dto/full-achievement.dto';
import { AchievementDto } from './dto/achievement.dto';
import { UserAchievementDto } from './dto/user-achievement.dto';

type MilestoneSource = 'messages' | 'streak';

interface MilestoneDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly source: MilestoneSource;
  readonly required: number;
}

const MILESTONES: readonly MilestoneDefinition[] = [
  {
    code: 'first_message',
    name: 'First Message',
    description: 'Send your first message in a chat.',
    source: 'messages',
    required: 1,
  },
  {
    code: '100_messages',
    name: '100 Messages',
    description: 'Send 100 messages in chats.',
    source: 'messages',
    required: 100,
  },
  {
    code: '500_messages',
    name: '500 Messages',
    description: 'Send 500 messages in chats.',
    source: 'messages',
    required: 500,
  },
  {
    code: '7_day_streak',
    name: '7-Day Streak',
    description: 'Keep a 7‑day study streak.',
    source: 'streak',
    required: 7,
  },
  {
    code: '30_day_streak',
    name: '30-Day Streak',
    description: 'Keep a 30‑day study streak.',
    source: 'streak',
    required: 30,
  },
];

const MESSAGE_MILESTONES = MILESTONES.filter(
  (milestone) => milestone.source === 'messages',
);
const STREAK_MILESTONES = MILESTONES.filter(
  (milestone) => milestone.source === 'streak',
);
const UNAVAILABLE_MESSAGE = 'Achievements are temporarily unavailable';

@Injectable()
export class AchievementsService implements OnModuleInit {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async onModuleInit(): Promise<void> {
    if (await this.seedAchievements()) {
      this.logger.log('achievements.seed_complete');
    }
  }

  private async seedAchievements(): Promise<boolean> {
    const achievements = MILESTONES.map((milestone) => ({
      code: milestone.code,
      name: milestone.name,
      description: milestone.description,
    }));

    try {
      const { error } = await this.supabaseService
        .getClient()
        .from('achievements')
        .upsert(achievements, { onConflict: 'code' });

      if (error) {
        this.logger.warn('achievements.seed_failed');
        return false;
      }
      return true;
    } catch {
      this.logger.warn('achievements.seed_failed');
      return false;
    }
  }

  async awardAchievement(
    userId: string,
    achievementCode: string,
  ): Promise<void> {
    const supabase = this.supabaseService.getClient();

    let achievementLookup;
    try {
      achievementLookup = await supabase
        .from('achievements')
        .select('id')
        .eq('code', achievementCode)
        .single();
    } catch {
      this.failUnavailable('definition_lookup');
    }

    if (achievementLookup.error) {
      this.failUnavailable('definition_lookup');
    }
    if (!achievementLookup.data) {
      this.logger.warn(
        `achievements.definition_missing code=${achievementCode}`,
      );
      return;
    }

    try {
      const { error } = await supabase
        .from('user_achievements')
        .upsert(
          { user_id: userId, achievement_id: achievementLookup.data.id },
          { onConflict: 'user_id,achievement_id' },
        );
      if (error) {
        this.failUnavailable('award_write');
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.failUnavailable('award_write');
    }
  }

  async hasAchievement(
    userId: string,
    achievementCode: string,
  ): Promise<boolean> {
    const supabase = this.supabaseService.getClient();
    let achievementLookup;
    try {
      achievementLookup = await supabase
        .from('achievements')
        .select('id')
        .eq('code', achievementCode)
        .single();
    } catch {
      this.failUnavailable('definition_lookup');
    }

    if (achievementLookup.error) {
      this.failUnavailable('definition_lookup');
    }
    if (!achievementLookup.data) return false;

    try {
      const { data, error } = await supabase
        .from('user_achievements')
        .select('id')
        .eq('user_id', userId)
        .eq('achievement_id', achievementLookup.data.id)
        .single();
      if (error && error.code !== 'PGRST116') {
        this.failUnavailable('earned_lookup');
      }
      return !!data;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.failUnavailable('earned_lookup');
    }
  }

  async listAchievements(): Promise<AchievementDto[]> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('achievements')
        .select('*')
        .returns<AchievementDto[]>();
      if (error) {
        this.failUnavailable('catalogue_read');
      }
      return data ?? [];
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.failUnavailable('catalogue_read');
    }
  }

  async getUserAchievements(userId: string): Promise<UserAchievementDto[]> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('user_achievements')
        .select('achievements(*)')
        .eq('user_id', userId)
        .returns<UserAchievementDto[]>();
      if (error) {
        this.failUnavailable('earned_read');
      }
      return data ?? [];
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.failUnavailable('earned_read');
    }
  }

  async getFullAchievements(userId: string): Promise<FullAchievementDto[]> {
    const supabase = this.supabaseService.getClient();
    let definitionResult;
    try {
      definitionResult = await supabase
        .from('achievements')
        .select('code, name, description')
        .order('code', { ascending: true })
        .returns<Pick<AchievementDto, 'code' | 'name' | 'description'>[]>();
    } catch {
      this.failUnavailable('catalogue_read');
    }

    if (definitionResult.error) {
      this.failUnavailable('catalogue_read');
    }
    const definitions = definitionResult.data;
    if (!definitions) {
      return [];
    }

    const [earnedRows, messageCount, streakDays] = await Promise.all([
      this.getUserAchievements(userId),
      this.getUserMessageCount(userId),
      this.getStudyStreakDays(userId),
    ]);

    const earnedCodes = new Set<string>();
    for (const row of earnedRows) {
      const code = row.achievements?.code;
      if (code) earnedCodes.add(code);
    }

    return definitions.map((definition) => {
      const milestone = MILESTONES.find(
        (candidate) => candidate.code === definition.code,
      );
      const current =
        milestone?.source === 'messages'
          ? messageCount
          : milestone?.source === 'streak'
            ? streakDays
            : 0;

      return {
        code: definition.code,
        name: definition.name,
        description: definition.description ?? '',
        current,
        required: milestone?.required ?? 0,
        earned: earnedCodes.has(definition.code),
      };
    });
  }

  async evaluateAchievements(userId: string): Promise<void> {
    const earnedRows = await this.getUserAchievements(userId);
    const earnedCodes = new Set<string>();
    for (const row of earnedRows) {
      const code = row.achievements?.code;
      if (code) earnedCodes.add(code);
    }

    const messageMilestonesComplete = MESSAGE_MILESTONES.every((milestone) =>
      earnedCodes.has(milestone.code),
    );
    const streakMilestonesComplete = STREAK_MILESTONES.every((milestone) =>
      earnedCodes.has(milestone.code),
    );

    const [messageCount, streakDays] = await Promise.all([
      messageMilestonesComplete
        ? Promise.resolve(0)
        : this.getUserMessageCount(userId),
      streakMilestonesComplete
        ? Promise.resolve(0)
        : this.getStudyStreakDays(userId),
    ]);

    const dueMilestones = MILESTONES.filter((milestone) => {
      if (earnedCodes.has(milestone.code)) return false;
      const current =
        milestone.source === 'messages' ? messageCount : streakDays;
      return current >= milestone.required;
    });

    if (dueMilestones.length === 0) return;

    const results = await Promise.allSettled(
      dueMilestones.map((milestone) =>
        this.awardAchievement(userId, milestone.code),
      ),
    );
    const failedAwards = results.filter(
      (result) => result.status === 'rejected',
    ).length;

    if (failedAwards > 0) {
      this.logger.error(
        `achievements.award_batch_failed count=${failedAwards}`,
      );
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
  }

  @OnEvent('achievements.evaluate')
  async handleEvaluationEvent(payload: { userId: string }): Promise<void> {
    await this.evaluateFromEvent(payload.userId);
  }

  @OnEvent('message.sent')
  async handleMessageSent(payload: { userId: string }): Promise<void> {
    await this.evaluateFromEvent(payload.userId);
  }

  private async evaluateFromEvent(userId: string): Promise<void> {
    try {
      await this.evaluateAchievements(userId);
    } catch {
      // Event delivery is best-effort. The next message/streak event safely retries
      // because user_achievements has a unique (user_id, achievement_id) constraint.
      this.logger.warn('achievements.event_evaluation_failed');
    }
  }

  private async getUserMessageCount(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabaseService
        .getClient()
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', userId);
      if (error) {
        this.failUnavailable('message_count');
      }
      return count ?? 0;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.failUnavailable('message_count');
    }
  }

  private async getStudyStreakDays(userId: string): Promise<number> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('users')
        .select('study_streak_days')
        .eq('id', userId)
        .single<{ study_streak_days: number | null }>();
      if (error) {
        this.failUnavailable('streak_read');
      }
      return data?.study_streak_days ?? 0;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.failUnavailable('streak_read');
    }
  }

  private failUnavailable(operation: string): never {
    this.logger.error(`achievements.${operation}_failed`);
    throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
  }
}
