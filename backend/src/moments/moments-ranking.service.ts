import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { MomentRecord } from './interfaces/moment.interface';

const MAX_CANDIDATES = 50;
const MAX_RECENT_LIKES = 100;
const MAX_FOLLOWS = 500;
const MAX_HASHTAGS_PER_MOMENT = 10;
const RECENCY_HALF_LIFE_HOURS = 48;
const AUTHOR_DIVERSITY_DECAY = 0.55;
const AUTHOR_DIVERSITY_FLOOR = 0.35;

interface FollowRow {
  following_id: string;
}

interface LikeRow {
  moment_id: string;
}

interface LikedMomentRow {
  text_content?: string | null;
}

interface ScoredMoment {
  moment: MomentRecord;
  score: number;
  createdAtMs: number;
}

export interface ForYouRankingContext {
  followedAuthorIds: ReadonlySet<string>;
  interestedHashtags: ReadonlySet<string>;
}

/**
 * A bounded, repository-native adaptation of the public X For You pipeline.
 *
 * X's published algorithm separates candidate retrieval/visibility from ranking,
 * uses viewer engagement history, and applies author-diversity adjustments after
 * scoring. ELGL keeps its existing Moments retrieval and safety boundaries, then
 * applies the same architecture with signals that are actually available here.
 * We deliberately do not treat raw likes/comments as X model probabilities.
 */
@Injectable()
export class MomentsRankingService {
  private readonly logger = new Logger(MomentsRankingService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async rankForYou(
    userId: string,
    candidates: MomentRecord[],
  ): Promise<MomentRecord[]> {
    const boundedCandidates = this.prepareCandidates(userId, candidates);
    if (boundedCandidates.length === 0) return [];

    let context: ForYouRankingContext = {
      followedAuthorIds: new Set<string>(),
      interestedHashtags: new Set<string>(),
    };

    try {
      context = await this.loadViewerContext(userId);
    } catch {
      // Personalisation is an ordering enhancement, not an availability boundary.
      // Keep the feed usable with deterministic public signals and never log IDs,
      // Moment text, provider errors, or other private viewer context.
      this.logger.warn('moments_for_you_context_unavailable');
    }

    return this.rankCandidates(boundedCandidates, context);
  }

  rankCandidates(
    candidates: MomentRecord[],
    context: ForYouRankingContext,
    nowMs = Date.now(),
  ): MomentRecord[] {
    const scored: ScoredMoment[] = candidates
      .slice(0, MAX_CANDIDATES)
      .map((moment) => {
        const createdAtMs = this.parseCreatedAt(moment.created_at, nowMs);
        const ageHours = Math.max(0, (nowMs - createdAtMs) / 3_600_000);
        const recencyScore = Math.exp(
          (-Math.LN2 * ageHours) / RECENCY_HALF_LIFE_HOURS,
        );

        const likes = this.safeCount(moment.likes_count);
        const comments = this.safeCount(moment.comments_count);
        const engagementScore = Math.min(
          1,
          (Math.log1p(likes) + 1.5 * Math.log1p(comments)) / 12,
        );

        const hashtags =
          moment.hashtags ?? this.extractHashtags(moment.text_content);
        const matchedHashtags = hashtags.filter((tag) =>
          context.interestedHashtags.has(tag),
        ).length;
        const hashtagAffinity = Math.min(1, matchedHashtags / 2);
        const inNetwork = context.followedAuthorIds.has(moment.user_id) ? 1 : 0;
        const pinned = moment.is_pinned ? 1 : 0;

        return {
          moment: {
            ...moment,
            hashtags,
          },
          score:
            recencyScore * 0.45 +
            engagementScore * 0.2 +
            inNetwork * 0.2 +
            hashtagAffinity * 0.13 +
            pinned * 0.02,
          createdAtMs,
        };
      });

    return this.applyAuthorDiversity(scored).map(({ moment }) => moment);
  }

  extractHashtags(text?: string | null): string[] {
    if (!text) return [];

    const tags: string[] = [];
    const seen = new Set<string>();
    const normalisedText = text.normalize('NFKC');
    const hashtagPattern = /#([\p{L}\p{N}_]{1,50})/gu;

    for (const match of normalisedText.matchAll(hashtagPattern)) {
      const tag = match[1]?.toLocaleLowerCase();
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
      if (tags.length >= MAX_HASHTAGS_PER_MOMENT) break;
    }

    return tags;
  }

  private prepareCandidates(
    userId: string,
    candidates: MomentRecord[],
  ): MomentRecord[] {
    const seen = new Set<string>();
    const prepared: MomentRecord[] = [];

    for (const candidate of candidates) {
      if (
        !candidate?.id ||
        !candidate.user_id ||
        candidate.user_id === userId ||
        candidate.id.startsWith('mock-moment-') ||
        seen.has(candidate.id)
      ) {
        continue;
      }

      seen.add(candidate.id);
      prepared.push({
        ...candidate,
        hashtags: this.extractHashtags(candidate.text_content),
      });
      if (prepared.length >= MAX_CANDIDATES) break;
    }

    return prepared;
  }

  private async loadViewerContext(
    userId: string,
  ): Promise<ForYouRankingContext> {
    const supabase = this.supabaseService.getClient();

    const [followResult, likeResult] = await Promise.all([
      supabase
        .from('user_follows')
        .select('following_id')
        .eq('follower_id', userId)
        .limit(MAX_FOLLOWS),
      supabase
        .from('moment_likes')
        .select('moment_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_RECENT_LIKES),
    ]);

    if (followResult.error || likeResult.error) {
      throw new Error('viewer ranking context unavailable');
    }

    const followedAuthorIds = new Set(
      ((followResult.data ?? []) as FollowRow[])
        .map((row) => row.following_id)
        .filter(Boolean),
    );

    const likedMomentIds = Array.from(
      new Set(
        ((likeResult.data ?? []) as LikeRow[])
          .map((row) => row.moment_id)
          .filter(Boolean),
      ),
    ).slice(0, MAX_RECENT_LIKES);

    const interestedHashtags = new Set<string>();
    if (likedMomentIds.length > 0) {
      const likedMomentsResult = await supabase
        .from('moments')
        .select('text_content')
        .in('id', likedMomentIds)
        .limit(MAX_RECENT_LIKES);

      if (likedMomentsResult.error) {
        throw new Error('viewer ranking history unavailable');
      }

      for (const moment of (likedMomentsResult.data ??
        []) as LikedMomentRow[]) {
        for (const hashtag of this.extractHashtags(moment.text_content)) {
          interestedHashtags.add(hashtag);
        }
      }
    }

    return { followedAuthorIds, interestedHashtags };
  }

  private applyAuthorDiversity(scored: ScoredMoment[]): ScoredMoment[] {
    const remaining = [...scored];
    const selected: ScoredMoment[] = [];
    const authorCounts = new Map<string, number>();

    while (remaining.length > 0) {
      let bestIndex = 0;
      let bestAdjustedScore = Number.NEGATIVE_INFINITY;

      for (let index = 0; index < remaining.length; index += 1) {
        const item = remaining[index];
        const priorAuthorCount = authorCounts.get(item.moment.user_id) ?? 0;
        const diversityFactor = Math.max(
          AUTHOR_DIVERSITY_FLOOR,
          AUTHOR_DIVERSITY_DECAY ** priorAuthorCount,
        );
        const adjustedScore = item.score * diversityFactor;

        const best = remaining[bestIndex];
        if (
          adjustedScore > bestAdjustedScore ||
          (adjustedScore === bestAdjustedScore &&
            (item.createdAtMs > best.createdAtMs ||
              (item.createdAtMs === best.createdAtMs &&
                item.moment.id.localeCompare(best.moment.id) < 0)))
        ) {
          bestIndex = index;
          bestAdjustedScore = adjustedScore;
        }
      }

      const [chosen] = remaining.splice(bestIndex, 1);
      if (!chosen) break;
      selected.push(chosen);
      authorCounts.set(
        chosen.moment.user_id,
        (authorCounts.get(chosen.moment.user_id) ?? 0) + 1,
      );
    }

    return selected;
  }

  private safeCount(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  private parseCreatedAt(createdAt: string, nowMs: number): number {
    const parsed = Date.parse(createdAt);
    return Number.isFinite(parsed) ? Math.min(parsed, nowMs) : nowMs;
  }
}
