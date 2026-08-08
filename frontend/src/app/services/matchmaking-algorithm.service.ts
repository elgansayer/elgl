import { Injectable, inject } from '@angular/core';
import { UserProfile } from './user.service';
import { I18nService } from './i18n.service';
import type { SearchFilterParams } from './discovery.service';

export interface PartnerScore {
  partner: UserProfile;
  totalScore: number;
  breakdown: {
    languageComplementarity: number;
    sharedInterests: number;
    activityStreak: number;
    seriousLearnerBonus: number;
  };
}

const WEIGHTS: Readonly<{
  languageComplementarity: number;
  sharedInterests: number;
  activityStreak: number;
  seriousLearnerBonus: number;
}> = {
  languageComplementarity: 40,
  sharedInterests: 30,
  activityStreak: 20,
  seriousLearnerBonus: 10,
};

const MAX_STREAK_DAYS = 365;

@Injectable({
  providedIn: 'root',
})
export class MatchmakingAlgorithmService {
  private readonly i18n = inject(I18nService);

  /**
   * Computes match scores for a list of candidate partners relative to the
   * current user, then sorts them highest-first. Designed to run entirely
   * offline using cached IndexedDB data when the PWA is disconnected.
   */
  scoreAndRank(
    currentUser: UserProfile,
    candidates: UserProfile[],
  ): PartnerScore[] {
    const scored = candidates.map((partner) => this.scorePartner(currentUser, partner));
    scored.sort((a, b) => b.totalScore - a.totalScore);
    return scored;
  }

  /**
   * Applies client-side filters to a list of scored partners. Only filters that
   * can be evaluated locally (age, gender, serious learner, availability) are
   * applied here; distance filtering relies on proximity data cached from the
   * last successful network request.
   */
  applyOfflineFilters(
    scored: PartnerScore[],
    filters: SearchFilterParams,
  ): PartnerScore[] {
    return scored.filter(({ partner }) => {
      if (filters.serious_learner_only && !((partner.study_streak_days ?? 0) > 7 && (partner.correction_ratio ?? 0) >= 0.8)) return false;
      if (filters.gender && filters.gender !== partner.gender) return false;
      if (filters.availability_morning && !partner.availability_morning) return false;
      if (filters.availability_afternoon && !partner.availability_afternoon) return false;
      if (filters.availability_evening && !partner.availability_evening) return false;

      if (filters.age_min !== undefined || filters.age_max !== undefined) {
        const age = partner.age;
        if (age === undefined || age === null) return true;
        if (filters.age_min !== undefined && age < filters.age_min) return false;
        if (filters.age_max !== undefined && age > filters.age_max) return false;
      }

      return true;
    });
  }

  /** Builds a human-readable label describing the primary match reason. */
  getMatchReasonLabel(score: PartnerScore): string {
    const { breakdown } = score;
    if (breakdown.languageComplementarity >= 30) {
      return this.i18n.translate('matchmaking.reasonLanguageExchange');
    }
    if (breakdown.sharedInterests >= 20) {
      return this.i18n.translate('matchmaking.reasonSharedInterests');
    }
    if (breakdown.seriousLearnerBonus >= 8) {
      return this.i18n.translate('matchmaking.reasonSeriousLearner');
    }
    if (breakdown.activityStreak >= 12) {
      return this.i18n.translate('matchmaking.reasonActiveLearner');
    }
    return this.i18n.translate('matchmaking.reasonGeneral');
  }

  // ---- Private scoring helpers ----

  private scorePartner(currentUser: UserProfile, partner: UserProfile): PartnerScore {
    const languageComplementarity = this.scoreLanguageComplementarity(currentUser, partner);
    const sharedInterests = this.scoreSharedInterests(currentUser, partner);
    const activityStreak = this.scoreActivityStreak(partner);
    const seriousLearnerBonus = this.scoreSeriousLearner(partner, currentUser);

    const totalScore =
      languageComplementarity +
      sharedInterests +
      activityStreak +
      seriousLearnerBonus;

    return {
      partner,
      totalScore: Math.min(100, Math.round(totalScore * 10) / 10),
      breakdown: {
        languageComplementarity,
        sharedInterests,
        activityStreak,
        seriousLearnerBonus,
      },
    };
  }

  /**
   * Scores how complementary the partner's languages are.
   * Full points when the partner is a native speaker of the user's target language
   * AND the partner is learning the user's native language (reciprocal match).
   */
  private scoreLanguageComplementarity(currentUser: UserProfile, partner: UserProfile): number {
    const myNative = currentUser.native_languages ?? [];
    const myTarget = currentUser.target_languages ?? [];
    const partnerNative = partner.native_languages ?? [];
    const partnerTarget = partner.target_languages ?? [];

    let score = 0;
    const maxScore = WEIGHTS.languageComplementarity;

    const partnerTeaches = partnerNative.filter((lang) => myTarget.includes(lang)).length;
    const partnerTeachesCount = myTarget.length > 0 ? partnerTeaches / myTarget.length : 0;
    score += (maxScore * 0.5) * Math.min(1, partnerTeachesCount);

    const canTeachPartner = myNative.filter((lang) => partnerTarget.includes(lang)).length;
    const canTeachRatio = partnerTarget.length > 0 ? canTeachPartner / partnerTarget.length : 0;
    score += (maxScore * 0.5) * Math.min(1, canTeachRatio);

    return Math.round(score * 10) / 10;
  }

  /** Scores based on shared interest tags / learning goals. */
  private scoreSharedInterests(currentUser: UserProfile, partner: UserProfile): number {
    if (!currentUser.learning_goals || !partner.learning_goals) {
      return 0;
    }

    const myGoals = new Set(currentUser.learning_goals.split(',').map((g) => g.trim().toLowerCase()).filter(Boolean));
    const partnerGoals = partner.learning_goals.split(',').map((g) => g.trim().toLowerCase()).filter(Boolean);

    if (myGoals.size === 0 || partnerGoals.length === 0) return 0;

    const sharedCount = partnerGoals.filter((g) => myGoals.has(g)).length;
    const ratio = sharedCount / Math.max(myGoals.size, partnerGoals.length);
    return Math.round(WEIGHTS.sharedInterests * ratio * 10) / 10;
  }

  /** Scores based on study streak days (capped). */
  private scoreActivityStreak(partner: UserProfile): number {
    const streak = partner.study_streak_days ?? 0;
    if (streak <= 0) return 0;
    const ratio = Math.min(streak, MAX_STREAK_DAYS) / MAX_STREAK_DAYS;
    return Math.round(WEIGHTS.activityStreak * ratio * 10) / 10;
  }

  /** Bonus for serious learners (study_streak_days > 7 AND correction_ratio >= 0.8), slightly boosted if current user is also one. */
  private scoreSeriousLearner(partner: UserProfile, currentUser: UserProfile): number {
    const isPartnerSerious = (partner.study_streak_days ?? 0) > 7 && (partner.correction_ratio ?? 0) >= 0.8;
    if (!isPartnerSerious) return 0;
    const isCurrentSerious = (currentUser.study_streak_days ?? 0) > 7 && (currentUser.correction_ratio ?? 0) >= 0.8;
    let bonus = WEIGHTS.seriousLearnerBonus;
    if (isCurrentSerious) {
      bonus = WEIGHTS.seriousLearnerBonus * 1.25;
    }
    return Math.round(bonus * 10) / 10;
  }
}