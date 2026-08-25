import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MomentRecord } from './interfaces/moment.interface';
import { MomentsService } from './moments.service';

export type MomentFeedFilter =
  | 'All'
  | 'Classmates'
  | 'Following'
  | 'For You';

interface UserFollowRow {
  following_id: string;
}

const MAX_FEED_ITEMS = 50;

/**
 * Applies the product/privacy contract for the public Moments feed filters.
 *
 * MomentsService remains responsible for retrieving and hydrating Moments. This
 * service is deliberately a narrow policy boundary around that existing path:
 * it removes legacy synthetic rows, re-validates filter membership, and keeps
 * every response bounded before it leaves the backend.
 */
@Injectable()
export class MomentsFeedService {
  private readonly logger = new Logger(MomentsFeedService.name);

  constructor(
    private readonly momentsService: MomentsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async getFeed(
    userId: string,
    filter: MomentFeedFilter,
    targetLanguage?: string,
  ): Promise<MomentRecord[]> {
    const normalisedLanguage = this.normaliseLanguage(targetLanguage);

    if (filter === 'Classmates' && !normalisedLanguage) {
      return [];
    }

    const feed = await this.momentsService.getFeed(
      userId,
      filter,
      normalisedLanguage ?? undefined,
    );

    let filtered = this.normaliseFeed(feed);

    if (filter === 'Classmates') {
      filtered = filtered.filter(
        (moment) =>
          this.normaliseLanguage(moment.target_language) === normalisedLanguage,
      );
    }

    if (filter === 'Following') {
      const followingIds = await this.getFollowingIds(userId);
      filtered = filtered.filter(
        (moment) =>
          moment.user_id !== userId && followingIds.has(moment.user_id),
      );
    }

    return filtered.slice(0, MAX_FEED_ITEMS);
  }

  private normaliseFeed(feed: MomentRecord[]): MomentRecord[] {
    const seen = new Set<string>();
    const result: MomentRecord[] = [];

    for (const moment of feed) {
      if (
        !moment?.id ||
        seen.has(moment.id) ||
        moment.id.startsWith('mock-moment-') ||
        moment.is_ephemeral ||
        (moment.post_type && moment.post_type !== 'moment')
      ) {
        continue;
      }

      seen.add(moment.id);
      result.push(moment);

      if (result.length >= MAX_FEED_ITEMS) {
        break;
      }
    }

    return result;
  }

  private async getFollowingIds(userId: string): Promise<Set<string>> {
    const supabase = this.supabaseService.getClient();
    const { data, error } = (await supabase
      .from('user_follows')
      .select('following_id')
      .eq('follower_id', userId)) as unknown as {
      data: UserFollowRow[] | null;
      error: { message?: string } | null;
    };

    if (error) {
      this.logger.warn('Moments Following filter membership lookup failed');
      throw new ServiceUnavailableException(
        'Moments feed is temporarily unavailable',
      );
    }

    return new Set(
      (data ?? [])
        .map((row) => row.following_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    );
  }

  private normaliseLanguage(language?: string): string | null {
    const value = language?.trim().toLowerCase();
    return value || null;
  }
}
