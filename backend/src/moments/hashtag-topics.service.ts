import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MomentRecord } from './interfaces/moment.interface';
import { MomentsRankingService } from './moments-ranking.service';
import { MomentsService } from './moments.service';

const MAX_FOLLOWED_HASHTAGS = 100;
const MAX_TOPIC_RESULTS = 50;
const DEFAULT_TRENDING_LIMIT = 8;
const MAX_TRENDING_LIMIT = 20;

interface FollowedHashtagRow {
  hashtag: string;
}

export interface HashtagTopicSummary {
  hashtag: string;
  count: number;
  is_following: boolean;
}

@Injectable()
export class HashtagTopicsService {
  private readonly logger = new Logger(HashtagTopicsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly momentsService: MomentsService,
    private readonly momentsRankingService: MomentsRankingService,
  ) {}

  normalizeHashtag(input: string): string {
    const hashtag = input
      .normalize('NFKC')
      .trim()
      .replace(/^#+/, '')
      .toLocaleLowerCase();

    if (!/^[\p{L}\p{N}_]{1,50}$/u.test(hashtag)) {
      throw new BadRequestException(
        'Hashtag must contain 1-50 letters, numbers, or underscores',
      );
    }

    return hashtag;
  }

  async listFollowed(userId: string): Promise<string[]> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = await supabase
      .from('followed_hashtags')
      .select('hashtag')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_FOLLOWED_HASHTAGS);

    if (error) {
      this.logger.warn('hashtag_follow_list_unavailable');
      throw new ServiceUnavailableException('Topic preferences are unavailable');
    }

    return ((data ?? []) as FollowedHashtagRow[])
      .map((row) => row.hashtag)
      .filter((hashtag) => /^[\p{L}\p{N}_]{1,50}$/u.test(hashtag))
      .slice(0, MAX_FOLLOWED_HASHTAGS);
  }

  async follow(
    userId: string,
    input: string,
  ): Promise<{ hashtag: string; is_following: true }> {
    const hashtag = this.normalizeHashtag(input);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.rpc('follow_hashtag', {
      p_user_id: userId,
      p_hashtag: hashtag,
    });

    if (error) {
      if (error.message?.includes('hashtag_follow_limit_reached')) {
        throw new BadRequestException(
          `You can follow up to ${MAX_FOLLOWED_HASHTAGS} topics`,
        );
      }
      this.logger.warn('hashtag_follow_mutation_failed');
      throw new ServiceUnavailableException('Unable to follow topic');
    }

    return { hashtag, is_following: true };
  }

  async unfollow(
    userId: string,
    input: string,
  ): Promise<{ hashtag: string; is_following: false }> {
    const hashtag = this.normalizeHashtag(input);
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase
      .from('followed_hashtags')
      .delete()
      .eq('user_id', userId)
      .eq('hashtag', hashtag);

    if (error) {
      this.logger.warn('hashtag_unfollow_mutation_failed');
      throw new ServiceUnavailableException('Unable to unfollow topic');
    }

    return { hashtag, is_following: false };
  }

  async getTopicsFeed(userId: string): Promise<MomentRecord[]> {
    const followed = new Set(await this.listFollowed(userId));
    if (followed.size === 0) return [];

    const feed = await this.getSafeVisibleFeed(userId);
    return feed
      .filter((moment) =>
        this.hashtagsFor(moment).some((hashtag) => followed.has(hashtag)),
      )
      .slice(0, MAX_TOPIC_RESULTS);
  }

  async getHashtagFeed(
    userId: string,
    input: string,
  ): Promise<{ hashtag: string; is_following: boolean; moments: MomentRecord[] }> {
    const hashtag = this.normalizeHashtag(input);
    const [feed, followed] = await Promise.all([
      this.getSafeVisibleFeed(userId),
      this.listFollowed(userId),
    ]);

    return {
      hashtag,
      is_following: followed.includes(hashtag),
      moments: feed
        .filter((moment) => this.hashtagsFor(moment).includes(hashtag))
        .slice(0, MAX_TOPIC_RESULTS),
    };
  }

  async getTrending(
    userId: string,
    requestedLimit = DEFAULT_TRENDING_LIMIT,
  ): Promise<HashtagTopicSummary[]> {
    const limit = this.normalizeTrendingLimit(requestedLimit);
    const [feed, followed] = await Promise.all([
      this.getSafeVisibleFeed(userId),
      this.listFollowed(userId),
    ]);
    const followedSet = new Set(followed);
    const counts = new Map<string, number>();

    for (const moment of feed) {
      for (const hashtag of this.hashtagsFor(moment)) {
        counts.set(hashtag, (counts.get(hashtag) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([hashtag, count]) => ({
        hashtag,
        count,
        is_following: followedSet.has(hashtag),
      }))
      .sort((a, b) => b.count - a.count || a.hashtag.localeCompare(b.hashtag))
      .slice(0, limit);
  }

  private normalizeTrendingLimit(limit: number): number {
    if (!Number.isFinite(limit)) return DEFAULT_TRENDING_LIMIT;
    return Math.min(MAX_TRENDING_LIMIT, Math.max(1, Math.floor(limit)));
  }

  private hashtagsFor(moment: MomentRecord): string[] {
    return this.momentsRankingService.extractHashtags(moment.text_content);
  }

  private async getSafeVisibleFeed(userId: string): Promise<MomentRecord[]> {
    try {
      const feed = await this.momentsService.getFeed(userId, 'All');
      return feed.filter(
        (moment) =>
          Boolean(moment?.id) &&
          !moment.id.startsWith('mock-moment-') &&
          Boolean(moment.user_id),
      );
    } catch {
      this.logger.warn('hashtag_visible_feed_unavailable');
      throw new ServiceUnavailableException('Topic feed is unavailable');
    }
  }
}
