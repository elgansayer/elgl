import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

export interface RecommendedUserDto {
  id: string;
  displayName: string | null | undefined;
  avatarUrl: string | null | undefined;
  nativeLanguage: string | null | undefined;
  targetLanguages: string[] | null | undefined;
  sharedInterests: number;
  isSeriousLearner: boolean | null | undefined;
  studyStreakDays: number | null | undefined;
  correctionRatio: number | null | undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async calculateDailyRecommendations() {
    this.logger.log('Starting daily recommendation calculations...');
    const supabase = this.supabaseService.getClient();
    const redis = this.supabaseService.getRedisClient();

    try {
      // Fetch all active users who are visible in search
      const { data: users, error } = await supabase
        .from('users')
        .select('id, native_language, target_languages')
        .eq('privacy_hide_from_search', false);

      if (error || !users) {
        throw new Error(`Failed to fetch users: ${error?.message}`);
      }

      for (const user of users) {
        const targetLanguages = user.target_languages as string[] | null;
        if (!targetLanguages || targetLanguages.length === 0) continue;

        // Find users who speak the target language natively and are learning the user's native language
        const { data: matches } = await supabase
          .from('users')
          .select('id, is_serious_learner')
          .neq('id', user.id)
          .eq('privacy_hide_from_search', false)
          .in('native_language', targetLanguages ?? [])
          .contains(
            'target_languages',
            user.native_language ? [user.native_language] : [],
          )
          .order('is_serious_learner', { ascending: false })
          .limit(10);

        if (matches && matches.length > 0) {
          const recommendedIds = matches.map((m) => m.id);

          // Cache the top 10 recommendations in Redis for 24 hours
          await redis.set(
            `recommendations:${user.id}`,
            JSON.stringify(recommendedIds),
            'EX',
            86400, // 24 hours
          );
        }
      }

      this.logger.log(
        'Successfully calculated and cached daily recommendations.',
      );
    } catch (error) {
      this.logger.error('Error calculating recommendations', error);
    }
  }

  async getRecommendations(userId: string): Promise<RecommendedUserDto[]> {
    const supabase = this.supabaseService.getClient();

    // 1. Fetch the current user's interest tags
    const { data: ownTags, error: tagsError } = await supabase
      .from('user_interests')
      .select('tag')
      .eq('user_id', userId);

    if (tagsError) {
      throw new Error(tagsError.message);
    }

    const tags: string[] = [];
    if (Array.isArray(ownTags)) {
      for (const row of ownTags) {
        if (isRecord(row)) {
          const value = row['tag'];
          if (typeof value === 'string') tags.push(value);
        }
      }
    }
    if (tags.length === 0) {
      return [];
    }

    // 2. Find other users that share at least one of the same tags
    const { data: shared, error: sharedError } = await supabase
      .from('user_interests')
      .select('user_id, tag')
      .in('tag', tags)
      .neq('user_id', userId);

    if (sharedError) {
      throw new Error(sharedError.message);
    }

    // 3. Count how many tags each candidate has in common
    const sharedCount = new Map<string, number>();
    if (Array.isArray(shared)) {
      for (const row of shared) {
        if (isRecord(row)) {
          const userIdValue = row['user_id'];
          if (typeof userIdValue === 'string') {
            sharedCount.set(
              userIdValue,
              (sharedCount.get(userIdValue) ?? 0) + 1,
            );
          }
        }
      }
    }

    if (sharedCount.size === 0) {
      return [];
    }

    const candidateIds = Array.from(sharedCount.keys());

    // 4. Fetch user profile details for all candidates
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_language, target_languages, is_serious_learner, study_streak_days, correction_ratio',
      )
      .in('id', candidateIds)
      .eq('privacy_hide_from_search', false);

    if (usersError) {
      throw new Error(usersError.message);
    }

    // 5. Build the DTO list, sort by the requested criteria, and limit to 20
    const recommended: RecommendedUserDto[] = (users ?? [])
      .map((u) => ({
        id: u.id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        nativeLanguage: u.native_language,
        targetLanguages: u.target_languages,
        sharedInterests: sharedCount.get(u.id) ?? 0,
        isSeriousLearner: u.is_serious_learner,
        studyStreakDays: u.study_streak_days,
        correctionRatio: u.correction_ratio,
      }))
      .sort((a, b) => {
        // 1. Most shared interests
        if (b.sharedInterests !== a.sharedInterests) {
          return b.sharedInterests - a.sharedInterests;
        }
        // 2. Serious learners first
        if (a.isSeriousLearner !== b.isSeriousLearner) {
          return b.isSeriousLearner ? 1 : -1;
        }
        // 3. Highest streak days
        return (b.studyStreakDays ?? 0) - (a.studyStreakDays ?? 0);
      })
      .slice(0, 20);

    return recommended;
  }
}
