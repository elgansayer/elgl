import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';

interface UserInterestTagRow {
  tag: string;
}

interface VocabularyRow {
  interest_tag: string;
  vocab_word: string;
  translation: string | null;
  srs_level: number;
}

export interface VocabularyEntry {
  interestTag: string;
  vocabWord: string;
  translation: string | null;
  srsLevel: number;
}

@Injectable()
export class UserInterestsService {
  private readonly logger = new Logger(UserInterestsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase(): SupabaseClient {
    return this.supabaseService.getClient();
  }

  async getUserInterests(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('user_interests')
      .select('tag')
      .eq('user_id', userId)
      .returns<UserInterestTagRow[]>();
    if (error) throw error;
    return (data ?? []).map((r) => r.tag);
  }

  async updateUserInterests(userId: string, tags: string[]): Promise<void> {
    // remove all existing interests
    await this.supabase.from('user_interests').delete().eq('user_id', userId);
    if (tags.length === 0) return;
    const rows = tags.map((tag) => ({ user_id: userId, tag }));
    const { error } = await this.supabase.from('user_interests').insert(rows);
    if (error) throw error;

    // Invalidate interest-based recommendation caches for this user.
    void this.invalidateInterestMatchmakingCaches(userId);
  }

  /**
   * Invalidate matchmaking caches that are affected by an interests mutation.
   * Interest changes affect both the interest-based recommendation tiers in
   * RecommendationsService and the interests overlap filter in discovery.
   */
  private async invalidateInterestMatchmakingCaches(
    userId: string,
  ): Promise<void> {
    try {
      const redis = this.supabaseService.getRedisClient();
      await redis.del(
        `daily_recommendations:${userId}`,
        `recommendations:daily:${userId}`,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to invalidate matchmaking caches after interests update for ${userId}: ${(err as Error)?.message ?? 'unknown'}`,
      );
    }
  }

  async getVocabularyForInterests(
    tags: string[],
    language: string,
  ): Promise<VocabularyEntry[]> {
    const { data, error } = await this.supabase
      .from('interest_vocabulary')
      .select('interest_tag, vocab_word, translation, srs_level')
      .in('interest_tag', tags)
      .eq('language', language)
      .returns<VocabularyRow[]>();
    if (error) throw error;
    return (data ?? []).map((r) => ({
      interestTag: r.interest_tag,
      vocabWord: r.vocab_word,
      translation: r.translation,
      srsLevel: r.srs_level,
    }));
  }
}
