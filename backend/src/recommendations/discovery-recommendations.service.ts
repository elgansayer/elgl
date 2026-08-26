import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SafetyService } from '../safety/safety.service';
import { SupabaseService } from '../supabase/supabase.service';
import { RecommendationsService } from './recommendations.service';

const CAROUSEL_LIMIT = 10;
const CANDIDATE_LIMIT = 80;
const INTEREST_ROW_LIMIT = 400;
const ACTIVE_DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WEEK_MS = 7 * ACTIVE_DAY_MS;

export type RecommendationReason =
  'language_exchange' | 'shared_interests' | 'active_recently' | 'study_streak';

export interface DiscoveryRecommendationDto {
  id: string;
  display_name: string;
  avatar_url: string | null;
  native_languages: string[];
  target_languages: string[];
  shared_interest_count: number;
  recommendation_reasons: RecommendationReason[];
}

interface CurrentUserSignals {
  nativeLanguages: string[];
  targetLanguages: string[];
}

interface CandidateRow {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  native_languages: string[] | null;
  target_languages: string[] | null;
  privacy_hide_from_search: boolean | null;
  privacy_hide_online_status: boolean | null;
  is_deletion_pending: boolean | null;
  is_deleted: boolean | null;
  is_serious_learner: boolean | null;
  study_streak_days: number | null;
  last_active_at: string | null;
}

interface InterestRow {
  user_id: string;
  tag: string;
}

interface RankedCandidate {
  candidate: CandidateRow;
  sharedInterestCount: number;
  score: number;
  reasons: RecommendationReason[];
  activityRank: number;
}

function normaliseLanguages(value: string[] | null | undefined): string[] {
  return Array.isArray(value)
    ? value
        .filter((language): language is string => typeof language === 'string')
        .map((language) => language.trim().toLowerCase())
        .filter(Boolean)
    : [];
}

function hasOverlap(left: string[], right: string[]): boolean {
  if (left.length === 0 || right.length === 0) return false;
  const rightSet = new Set(right);
  return left.some((value) => rightSet.has(value));
}

function getActivityRank(candidate: CandidateRow, nowMs: number): number {
  if (candidate.privacy_hide_online_status || !candidate.last_active_at) {
    return 0;
  }
  const lastActiveMs = Date.parse(candidate.last_active_at);
  if (!Number.isFinite(lastActiveMs)) return 0;
  const ageMs = Math.max(0, nowMs - lastActiveMs);
  if (ageMs <= ACTIVE_DAY_MS) return 2;
  if (ageMs <= ACTIVE_WEEK_MS) return 1;
  return 0;
}

export function rankDiscoveryRecommendations(
  currentUser: CurrentUserSignals,
  candidates: CandidateRow[],
  sharedInterestCounts: ReadonlyMap<string, number>,
  nowMs = Date.now(),
  limit = CAROUSEL_LIMIT,
): DiscoveryRecommendationDto[] {
  const ownNative = normaliseLanguages(currentUser.nativeLanguages);
  const ownTargets = normaliseLanguages(currentUser.targetLanguages);

  const ranked: RankedCandidate[] = [];

  for (const candidate of candidates) {
    const nativeLanguages = normaliseLanguages(candidate.native_languages);
    const targetLanguages = normaliseLanguages(candidate.target_languages);
    const displayName = candidate.display_name?.trim() ?? '';

    if (
      !candidate.id ||
      !displayName ||
      nativeLanguages.length === 0 ||
      targetLanguages.length === 0 ||
      candidate.privacy_hide_from_search === true ||
      candidate.is_deletion_pending === true ||
      candidate.is_deleted === true
    ) {
      continue;
    }

    const reciprocalLanguageMatch =
      hasOverlap(nativeLanguages, ownTargets) &&
      hasOverlap(targetLanguages, ownNative);
    const sharedInterestCount = Math.max(
      0,
      Math.min(3, sharedInterestCounts.get(candidate.id) ?? 0),
    );
    const activityRank = getActivityRank(candidate, nowMs);
    const hasStudyStreak = (candidate.study_streak_days ?? 0) >= 7;

    let score = 0;
    const reasons: RecommendationReason[] = [];

    if (reciprocalLanguageMatch) {
      score += 50;
      reasons.push('language_exchange');
    }
    if (sharedInterestCount > 0) {
      score += sharedInterestCount * 15;
      reasons.push('shared_interests');
    }
    if (activityRank === 2) {
      score += 20;
      reasons.push('active_recently');
    } else if (activityRank === 1) {
      score += 10;
      reasons.push('active_recently');
    }
    if (hasStudyStreak || candidate.is_serious_learner === true) {
      score += 10;
      reasons.push('study_streak');
    }

    if (score === 0) continue;

    ranked.push({
      candidate,
      sharedInterestCount,
      score,
      reasons,
      activityRank,
    });
  }

  return ranked
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.sharedInterestCount - left.sharedInterestCount ||
        right.activityRank - left.activityRank ||
        left.candidate.id.localeCompare(right.candidate.id),
    )
    .slice(0, Math.max(1, Math.min(CAROUSEL_LIMIT, limit)))
    .map(({ candidate, sharedInterestCount, reasons }) => ({
      id: candidate.id,
      display_name: candidate.display_name!.trim(),
      avatar_url: candidate.avatar_url ?? null,
      native_languages: normaliseLanguages(candidate.native_languages),
      target_languages: normaliseLanguages(candidate.target_languages),
      shared_interest_count: sharedInterestCount,
      recommendation_reasons: reasons,
    }));
}

@Injectable()
export class DiscoveryRecommendationsService {
  constructor(
    @InjectPinoLogger(DiscoveryRecommendationsService.name)
    private readonly logger: PinoLogger,
    private readonly supabaseService: SupabaseService,
    private readonly safetyService: SafetyService,
    private readonly recommendationsService: RecommendationsService,
  ) {}

  async getForDiscovery(userId: string): Promise<DiscoveryRecommendationDto[]> {
    const supabase = this.supabaseService.getClient();

    const { data: currentUser, error: currentUserError } = await supabase
      .from('users')
      .select('native_languages, target_languages')
      .eq('id', userId)
      .maybeSingle();

    if (currentUserError || !currentUser) {
      throw new Error('Unable to load recommendation profile');
    }

    const currentSignals: CurrentUserSignals = {
      nativeLanguages: normaliseLanguages(currentUser['native_languages']),
      targetLanguages: normaliseLanguages(currentUser['target_languages']),
    };

    if (
      currentSignals.nativeLanguages.length === 0 ||
      currentSignals.targetLanguages.length === 0
    ) {
      return [];
    }

    const candidateIds = new Set<string>();
    const sharedInterestCounts = new Map<string, number>();

    // Reuse the canonical daily recommendation pipeline/cache as the first seed.
    // Cached profile data itself is never returned: all IDs are re-hydrated below
    // through the current privacy/deletion/block boundary before ranking.
    try {
      const daily =
        await this.recommendationsService.getDailyRecommendations(userId);
      for (const recommendation of daily.slice(0, CANDIDATE_LIMIT)) {
        if (recommendation.id && recommendation.id !== userId) {
          candidateIds.add(recommendation.id);
        }
      }
    } catch {
      this.logger.warn(
        'Daily recommendation seed unavailable; continuing live',
      );
    }

    let ownTags: string[] = [];
    try {
      const { data: ownInterests, error } = await supabase
        .from('user_interests')
        .select('tag')
        .eq('user_id', userId)
        .limit(50);
      if (error) throw error;
      ownTags = Array.from(
        new Set(
          ((ownInterests ?? []) as Array<{ tag?: unknown }>)
            .map((row) => (typeof row.tag === 'string' ? row.tag.trim() : ''))
            .filter(Boolean),
        ),
      );
    } catch {
      this.logger.warn('Interest recommendation seed unavailable; continuing');
    }

    if (ownTags.length > 0) {
      try {
        const { data: sharedRows, error } = await supabase
          .from('user_interests')
          .select('user_id, tag')
          .in('tag', ownTags)
          .neq('user_id', userId)
          .limit(INTEREST_ROW_LIMIT);
        if (error) throw error;

        for (const row of (sharedRows ?? []) as InterestRow[]) {
          if (!row.user_id || typeof row.tag !== 'string') continue;
          candidateIds.add(row.user_id);
          sharedInterestCounts.set(
            row.user_id,
            (sharedInterestCounts.get(row.user_id) ?? 0) + 1,
          );
          if (candidateIds.size >= CANDIDATE_LIMIT) break;
        }
      } catch {
        this.logger.warn('Shared-interest seed unavailable; continuing');
      }
    }

    // The daily cache can legitimately be cold after deploy. Add a bounded live
    // reciprocal-language seed without creating a second unbounded recommender.
    if (candidateIds.size < CAROUSEL_LIMIT) {
      try {
        const { data: languageMatches, error } = await supabase
          .from('users')
          .select('id')
          .neq('id', userId)
          .eq('privacy_hide_from_search', false)
          .eq('is_deletion_pending', false)
          .overlaps('native_languages', currentSignals.targetLanguages)
          .overlaps('target_languages', currentSignals.nativeLanguages)
          .limit(CANDIDATE_LIMIT);
        if (error) throw error;
        for (const match of (languageMatches ?? []) as Array<{ id?: string }>) {
          if (match.id) candidateIds.add(match.id);
          if (candidateIds.size >= CANDIDATE_LIMIT) break;
        }
      } catch {
        this.logger.warn(
          'Language recommendation seed unavailable; continuing',
        );
      }
    }

    if (candidateIds.size === 0) return [];

    const blockedIds = new Set(
      await this.safetyService.getBlockedAndBlockerIds(userId),
    );
    const boundedIds = Array.from(candidateIds)
      .filter(
        (candidateId) => candidateId !== userId && !blockedIds.has(candidateId),
      )
      .slice(0, CANDIDATE_LIMIT);

    if (boundedIds.length === 0) return [];

    const { data: candidates, error: candidatesError } = await supabase
      .from('users')
      .select(
        'id, display_name, avatar_url, native_languages, target_languages, privacy_hide_from_search, privacy_hide_online_status, is_deletion_pending, is_deleted, is_serious_learner, study_streak_days, last_active_at',
      )
      .in('id', boundedIds)
      .eq('privacy_hide_from_search', false)
      .eq('is_deletion_pending', false)
      .eq('is_deleted', false)
      .not('display_name', 'is', null)
      .not('native_languages', 'is', null)
      .not('target_languages', 'is', null)
      .limit(CANDIDATE_LIMIT);

    if (candidatesError) {
      throw new Error('Unable to validate recommendation candidates');
    }

    const visibleCandidates = ((candidates ?? []) as CandidateRow[]).filter(
      (candidate) => !blockedIds.has(candidate.id),
    );

    return rankDiscoveryRecommendations(
      currentSignals,
      visibleCandidates,
      sharedInterestCounts,
    );
  }
}
