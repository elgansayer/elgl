import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import {
  ACHIEVEMENTS_EVALUATE_EVENT,
  AchievementsEvaluatePayload,
  MILESTONE_SOURCES,
  MilestoneSource,
} from './achievements.events';
import { FullAchievementDto } from './dto/full-achievement.dto';
import { AchievementDto } from './dto/achievement.dto';
import { UnlockedAchievementDto } from './dto/unlocked-achievement.dto';
import { UserAchievementDto } from './dto/user-achievement.dto';

interface MilestoneDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly source: MilestoneSource;
  readonly required: number;
}

interface UnlockedAchievementRow {
  unlocked_at: string | null;
  achievements: {
    code: string;
    name: string;
    description: string | null;
  } | null;
}

interface CountResult {
  count: number | null;
  error: unknown;
}

export const MILESTONES: readonly MilestoneDefinition[] = [
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
  {
    code: 'first_correction',
    name: 'First Correction',
    description: 'Correct a language partner in a Moment comment.',
    source: 'corrections',
    required: 1,
  },
  {
    code: '25_corrections',
    name: '25 Corrections',
    description: 'Make 25 corrections in Moment comments.',
    source: 'corrections',
    required: 25,
  },
  {
    code: '100_corrections',
    name: '100 Corrections',
    description: 'Make 100 corrections in Moment comments.',
    source: 'corrections',
    required: 100,
  },
  {
    code: 'first_moment',
    name: 'First Moment',
    description: 'Share your first Moment.',
    source: 'moments',
    required: 1,
  },
  {
    code: '10_moments',
    name: '10 Moments',
    description: 'Share 10 Moments.',
    source: 'moments',
    required: 10,
  },
  {
    code: 'first_lesson',
    name: 'First Lesson',
    description: 'Complete your first lesson.',
    source: 'lessons',
    required: 1,
  },
  {
    code: '10_lessons',
    name: '10 Lessons',
    description: 'Complete 10 lessons.',
    source: 'lessons',
    required: 10,
  },
];

const MILESTONE_BY_CODE = new Map(
  MILESTONES.map((milestone) => [milestone.code, milestone]),
);
const MILESTONES_BY_SOURCE = new Map<MilestoneSource, MilestoneDefinition[]>(
  MILESTONE_SOURCES.map((source) => [
    source,
    MILESTONES.filter((milestone) => milestone.source === source),
  ]),
);
// Once every milestone for a source is earned the source is never queried again;
// this value stands in for the (unneeded) live progress.
const MAX_PROGRESS_BY_SOURCE = new Map<MilestoneSource, number>(
  MILESTONE_SOURCES.map((source) => [
    source,
    Math.max(
      ...(MILESTONES_BY_SOURCE.get(source) ?? []).map(
        (milestone) => milestone.required,
      ),
    ),
  ]),
);
// Message delivery keeps its historical scope (messages and streak). Moments,
// corrections and lessons are evaluated by the events their own writes emit.
const MESSAGE_EVENT_SOURCES: readonly MilestoneSource[] = [
  'messages',
  'streak',
];
const UNLOCKED_REPORT_LIMIT = 50;
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
    let definitionResult: {
      data: Pick<AchievementDto, 'code' | 'name' | 'description'>[] | null;
      error: unknown;
    };
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

    const earnedCodes = await this.getEarnedCodes(userId);
    const sources = MILESTONE_SOURCES.filter((source) =>
      definitions.some(
        (definition) =>
          MILESTONE_BY_CODE.get(definition.code)?.source === source,
      ),
    );
    const progress = await this.readProgress(userId, sources, earnedCodes);

    return definitions.map((definition) => {
      const milestone = MILESTONE_BY_CODE.get(definition.code);

      return {
        code: definition.code,
        name: definition.name,
        description: definition.description ?? '',
        current: milestone ? (progress.get(milestone.source) ?? 0) : 0,
        required: milestone?.required ?? 0,
        earned: earnedCodes.has(definition.code),
      };
    });
  }

  /**
   * Unlocks every badge whose persisted progress has reached its threshold.
   * Pass `sources` to restrict the lookup to the progress that just changed.
   */
  async evaluateAchievements(
    userId: string,
    sources: readonly MilestoneSource[] = MILESTONE_SOURCES,
  ): Promise<void> {
    const requested = MILESTONE_SOURCES.filter((source) =>
      sources.includes(source),
    );
    if (requested.length === 0) return;

    const earnedCodes = await this.getEarnedCodes(userId);
    const progress = await this.readProgress(userId, requested, earnedCodes);

    const dueMilestones = MILESTONES.filter(
      (milestone) =>
        !earnedCodes.has(milestone.code) &&
        (progress.get(milestone.source) ?? 0) >= milestone.required,
    );

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

  /**
   * Badges unlocked inside [start, end), newest first and hard-bounded, for the
   * caller's performance report. Reads only the caller's own rows.
   */
  async getUnlockedBetween(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<UnlockedAchievementDto[]> {
    try {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('user_achievements')
        .select('unlocked_at, achievements(code, name, description)')
        .eq('user_id', userId)
        .gte('unlocked_at', start.toISOString())
        .lt('unlocked_at', end.toISOString())
        .order('unlocked_at', { ascending: false })
        .limit(UNLOCKED_REPORT_LIMIT)
        .returns<UnlockedAchievementRow[]>();
      if (error) {
        this.failUnavailable('unlocked_read');
      }
      return (data ?? []).flatMap((row) =>
        row.achievements && row.unlocked_at
          ? [
              {
                code: row.achievements.code,
                name: row.achievements.name,
                description: row.achievements.description ?? '',
                unlocked_at: row.unlocked_at,
              },
            ]
          : [],
      );
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.failUnavailable('unlocked_read');
    }
  }

  @OnEvent(ACHIEVEMENTS_EVALUATE_EVENT)
  async handleEvaluationEvent(
    payload: AchievementsEvaluatePayload,
  ): Promise<void> {
    await this.evaluateFromEvent(payload.userId, payload.sources);
  }

  @OnEvent('message.sent')
  async handleMessageSent(payload: { userId: string }): Promise<void> {
    await this.evaluateFromEvent(payload.userId, MESSAGE_EVENT_SOURCES);
  }

  private async evaluateFromEvent(
    userId: string,
    sources?: readonly MilestoneSource[],
  ): Promise<void> {
    try {
      await this.evaluateAchievements(userId, sources);
    } catch {
      // Event delivery is best-effort. The next qualifying event safely retries
      // because user_achievements has a unique (user_id, achievement_id) constraint.
      this.logger.warn('achievements.event_evaluation_failed');
    }
  }

  private async getEarnedCodes(userId: string): Promise<Set<string>> {
    const earnedRows = await this.getUserAchievements(userId);
    const earnedCodes = new Set<string>();
    for (const row of earnedRows) {
      const code = row.achievements?.code;
      if (code) earnedCodes.add(code);
    }
    return earnedCodes;
  }

  /**
   * Reads live progress once per requested source, in parallel. A source whose
   * milestones are all earned is not queried again.
   */
  private async readProgress(
    userId: string,
    sources: readonly MilestoneSource[],
    earnedCodes: ReadonlySet<string>,
  ): Promise<Map<MilestoneSource, number>> {
    const entries = await Promise.all(
      sources.map(async (source): Promise<[MilestoneSource, number]> => {
        const complete = (MILESTONES_BY_SOURCE.get(source) ?? []).every(
          (milestone) => earnedCodes.has(milestone.code),
        );
        const value = complete
          ? (MAX_PROGRESS_BY_SOURCE.get(source) ?? 0)
          : await this.readSource(source, userId);
        return [source, value];
      }),
    );
    return new Map(entries);
  }

  private readSource(source: MilestoneSource, userId: string): Promise<number> {
    switch (source) {
      case 'messages':
        return this.getUserMessageCount(userId);
      case 'streak':
        return this.getStudyStreakDays(userId);
      case 'corrections':
        return this.getCorrectionCount(userId);
      case 'moments':
        return this.getMomentCount(userId);
      case 'lessons':
        return this.getCompletedLessonCount(userId);
    }
  }

  private getUserMessageCount(userId: string): Promise<number> {
    return this.readCount('message_count', () =>
      this.supabaseService
        .getClient()
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', userId),
    );
  }

  // Same definition as the My Stats dashboard: Moment comments with a correction.
  private getCorrectionCount(userId: string): Promise<number> {
    return this.readCount('correction_count', () =>
      this.supabaseService
        .getClient()
        .from('moment_comments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .not('correction_payload', 'is', null),
    );
  }

  private getMomentCount(userId: string): Promise<number> {
    return this.readCount('moment_count', () =>
      this.supabaseService
        .getClient()
        .from('moments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    );
  }

  private getCompletedLessonCount(userId: string): Promise<number> {
    return this.readCount('lesson_count', () => {
      // lesson_progress is not in the generated Database types yet.
      const client: SupabaseClient = this.supabaseService.getClient();
      return client
        .from('lesson_progress')
        .select('lesson_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', true);
    });
  }

  private async readCount(
    operation: string,
    query: () => PromiseLike<CountResult>,
  ): Promise<number> {
    let result: CountResult;
    try {
      result = await query();
    } catch {
      this.failUnavailable(operation);
    }
    if (result.error) {
      this.failUnavailable(operation);
    }
    return result.count ?? 0;
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
