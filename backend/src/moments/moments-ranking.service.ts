import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from '../metrics/metrics.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MomentRecord } from './interfaces/moment.interface';
import {
  FOR_YOU_CANDIDATE_POOL_LIMIT,
  FOR_YOU_RESULT_LIMIT,
} from './moments-for-you.constants';

const MAX_RECENT_LIKES = 100;
const MAX_FOLLOWS = 500;
const MAX_HASHTAGS_PER_MOMENT = 10;
const RECENCY_HALF_LIFE_HOURS = 48;
const AUTHOR_DIVERSITY_DECAY = 0.55;
const AUTHOR_DIVERSITY_FLOOR = 0.35;

// A tag starts with a letter, digit or underscore and continues with letters,
// combining marks (Indic vowel signs, Arabic harakat, Hebrew niqqud), digits,
// underscores and the zero-width non-joiner that Persian tags rely on.
// Excluding \p{M} would truncate #हिन्दी to its first letter.
const HASHTAG_PATTERN = /#([\p{L}\p{N}_][\p{L}\p{M}\p{N}_\u200c]{0,49})/gu;
const TRAILING_ZWNJ_PATTERN = /\u200c+$/u;

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
 *
 * The ranker scores up to FOR_YOU_CANDIDATE_POOL_LIMIT candidates and returns
 * the best FOR_YOU_RESULT_LIMIT, so the ranking (not the retrieval order)
 * decides which Moments are served.
 */
@Injectable()
export class MomentsRankingService {
  private readonly logger = new Logger(MomentsRankingService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly metricsService: MetricsService,
  ) {}

  async rankForYou(
    userId: string,
    candidates: MomentRecord[],
  ): Promise<MomentRecord[]> {
    const startedAt = performance.now();
    const pool = this.prepareCandidates(userId, candidates);
    this.metricsService.observeMomentsForYouCandidates('pool', pool.length);

    if (pool.length === 0) {
      this.finishRanking('empty', 0, startedAt);
      return [];
    }

    let context: ForYouRankingContext = {
      followedAuthorIds: new Set<string>(),
      interestedHashtags: new Set<string>(),
    };
    let degraded = false;

    try {
      context = await this.loadViewerContext(userId);
    } catch {
      // Personalisation is an ordering enhancement, not an availability boundary.
      // Keep the feed usable with deterministic public signals and never log IDs,
      // Moment text, provider errors, or other private viewer context.
      degraded = true;
      this.logger.warn('moments_for_you_context_unavailable');
      this.metricsService.recordMomentsForYouDegraded(
        'viewer_context_unavailable',
      );
    }

    const ranked = this.rankCandidates(pool, context);
    this.finishRanking(
      degraded ? 'degraded' : 'ranked',
      ranked.length,
      startedAt,
    );
    return ranked;
  }

  rankCandidates(
    candidates: MomentRecord[],
    context: ForYouRankingContext,
    nowMs = Date.now(),
  ): MomentRecord[] {
    const scored: ScoredMoment[] = candidates
      .slice(0, FOR_YOU_CANDIDATE_POOL_LIMIT)
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

    return this.applyAuthorDiversity(scored, FOR_YOU_RESULT_LIMIT).map(
      ({ moment }) => moment,
    );
  }

  extractHashtags(text?: string | null): string[] {
    if (!text) return [];

    const tags: string[] = [];
    const seen = new Set<string>();
    const normalisedText = text.normalize('NFKC');

    for (const match of normalisedText.matchAll(HASHTAG_PATTERN)) {
      const tag = match[1]
        ?.replace(TRAILING_ZWNJ_PATTERN, '')
        .toLocaleLowerCase();
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
        seen.has(candidate.id)
      ) {
        continue;
      }

      seen.add(candidate.id);
      prepared.push({
        ...candidate,
        hashtags: this.extractHashtags(candidate.text_content),
      });
      if (prepared.length >= FOR_YOU_CANDIDATE_POOL_LIMIT) break;
    }

    return prepared;
  }

  private finishRanking(
    outcome: 'ranked' | 'degraded' | 'empty',
    servedCount: number,
    startedAt: number,
  ): void {
    this.metricsService.observeMomentsForYouCandidates('served', servedCount);
    this.metricsService.observeMomentsForYouRanking(
      outcome,
      (performance.now() - startedAt) / 1000,
    );
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

  private applyAuthorDiversity(
    scored: ScoredMoment[],
    limit: number,
  ): ScoredMoment[] {
    const remaining = [...scored];
    const selected: ScoredMoment[] = [];
    const authorCounts = new Map<string, number>();

    while (remaining.length > 0 && selected.length < limit) {
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
