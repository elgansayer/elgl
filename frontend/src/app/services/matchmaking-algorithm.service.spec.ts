import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';

import { MatchmakingAlgorithmService } from './matchmaking-algorithm.service';
import { CrashReportService } from './crash-report.service';
import { I18nService } from './i18n.service';
import { UserProfile } from './user.service';

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: `user-${crypto.randomUUID()}`,
    display_name: 'Test User',
    native_languages: ['en'],
    target_languages: ['ja'],
    bio_text: 'Hello',
    avatar_url: 'https://i.pravatar.cc/150',
    is_vip: false,
    vip_tier: 'free',
    coins_balance: 100,
    study_streak_days: 10,
    correction_ratio: 0.5,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    learning_goals: 'conversation,vocabulary',
    availability_morning: false,
    availability_afternoon: true,
    availability_evening: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('MatchmakingAlgorithmService', () => {
  let service: MatchmakingAlgorithmService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MatchmakingAlgorithmService,
        {
          provide: CrashReportService,
          useValue: {
            reportCrash: (): Promise<void> => Promise.resolve(),
            lastCrash: () => null,
            pendingCrashCount: () => 0,
          },
        },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
            translations: () => ({}),
          },
        },
      ],
    });

    service = TestBed.inject(MatchmakingAlgorithmService);
  });

  describe('scoreAndRank', () => {
    it('should sort partners by totalScore descending', () => {
      const current = makeUser({
        native_languages: ['en'],
        target_languages: ['ja'],
      });

      const best = makeUser({
        id: 'best',
        native_languages: ['ja'],
        target_languages: ['en'],
        study_streak_days: 100,
        is_serious_learner: true,
        learning_goals: 'conversation,vocabulary',
      });

      const medium = makeUser({
        id: 'medium',
        native_languages: ['ja'],
        target_languages: ['fr'],
        study_streak_days: 5,
        is_serious_learner: false,
        learning_goals: 'conversation',
      });

      const worst = makeUser({
        id: 'worst',
        native_languages: ['fr'],
        target_languages: ['de'],
        study_streak_days: 0,
        is_serious_learner: false,
        learning_goals: 'grammar',
      });

      const results = service.scoreAndRank(current, [worst, best, medium]);

      expect(results.data).toHaveLength(3);
      expect(results.degraded).toBe(false);
      expect(results.data[0].partner.id).toBe('best');
      expect(results.data[2].partner.id).toBe('worst');
      expect(results.data[0].totalScore).toBeGreaterThan(results.data[1].totalScore);
      expect(results.data[1].totalScore).toBeGreaterThanOrEqual(results.data[2].totalScore);
    });

    it('should cap totalScore at 100', () => {
      const current = makeUser({
        native_languages: ['en'],
        target_languages: ['ja'],
        is_serious_learner: true,
        learning_goals: 'conversation,vocabulary',
      });
      const perfect = makeUser({
        native_languages: ['ja'],
        target_languages: ['en'],
        study_streak_days: 400,
        is_serious_learner: true,
        learning_goals: 'conversation,vocabulary',
      });

      const results = service.scoreAndRank(current, [perfect]);
      expect(results.data[0].totalScore).toBeLessThanOrEqual(100);
    });

    it('should return empty data array and degraded=false for no candidates', () => {
      const results = service.scoreAndRank(makeUser(), []);
      expect(results.data).toEqual([]);
      expect(results.degraded).toBe(false);
    });

    it('should handle users with no target languages gracefully', () => {
      const current = makeUser({ native_languages: ['en'], target_languages: [] });
      const partner = makeUser({ native_languages: ['ja'], target_languages: ['en'] });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data).toHaveLength(1);
      expect(results.data[0].breakdown.languageComplementarity).toBeGreaterThan(0);
    });
  });

  describe('language complementarity scoring', () => {
    it('should give full marks for reciprocal language exchange', () => {
      const current = makeUser({ native_languages: ['en'], target_languages: ['ja'] });
      const partner = makeUser({ native_languages: ['ja'], target_languages: ['en'] });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.languageComplementarity).toBe(40);
    });

    it('should give half marks when partner teaches but does not learn', () => {
      const current = makeUser({ native_languages: ['en'], target_languages: ['ja'] });
      const partner = makeUser({ native_languages: ['ja'], target_languages: ['de'] });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.languageComplementarity).toBe(20);
    });

    it('should give zero for unrelated language pairs', () => {
      const current = makeUser({ native_languages: ['en'], target_languages: ['ja'] });
      const partner = makeUser({ native_languages: ['fr'], target_languages: ['de'] });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.languageComplementarity).toBe(0);
    });
  });

  describe('shared interests scoring', () => {
    it('should score based on shared learning goals', () => {
      const current = makeUser({ learning_goals: 'conversation,vocabulary,grammar' });
      const partner = makeUser({ learning_goals: 'conversation,grammar' });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.sharedInterests).toBeCloseTo(20, 1);
    });

    it('should give zero when no learning goals set', () => {
      const current = makeUser({ learning_goals: undefined });
      const partner = makeUser({ learning_goals: 'conversation' });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.sharedInterests).toBe(0);
    });
  });

  describe('activity streak scoring', () => {
    it('should give higher score for longer streaks', () => {
      const current = makeUser();
      const lowStreak = makeUser({ id: 'low', study_streak_days: 5 });
      const highStreak = makeUser({ id: 'high', study_streak_days: 200 });

      const results = service.scoreAndRank(current, [lowStreak, highStreak]);
      expect(results.data[0].partner.id).toBe('high');
    });

    it('should give zero for zero streak', () => {
      const current = makeUser();
      const partner = makeUser({ study_streak_days: 0 });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.activityStreak).toBe(0);
    });
  });

  describe('serious learner bonus', () => {
    it('should give bonus for serious learners', () => {
      const current = makeUser({ is_serious_learner: false });
      const partner = makeUser({ is_serious_learner: true });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.seriousLearnerBonus).toBe(10);
    });

    it('should give extra bonus when both are serious learners', () => {
      const current = makeUser({ is_serious_learner: true });
      const partner = makeUser({ is_serious_learner: true });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.seriousLearnerBonus).toBe(12.5);
    });

    it('should give zero for non-serious learners', () => {
      const current = makeUser();
      const partner = makeUser({ is_serious_learner: false });

      const results = service.scoreAndRank(current, [partner]);
      expect(results.data[0].breakdown.seriousLearnerBonus).toBe(0);
    });
  });

  describe('applyOfflineFilters', () => {
    it('should filter by seriousness', () => {
      const current = makeUser();
      const scored = service.scoreAndRank(current, [
        makeUser({ id: 'serious', is_serious_learner: true }),
        makeUser({ id: 'not-serious', is_serious_learner: false }),
      ]);

      const filtered = service.applyOfflineFilters(scored.data, { serious_learner_only: true });
      expect(filtered.data).toHaveLength(1);
      expect(filtered.degraded).toBe(false);
      expect(filtered.data[0].partner.id).toBe('serious');
    });

    it('should filter by gender', () => {
      const current = makeUser();
      const scored = service.scoreAndRank(current, [
        makeUser({ id: 'male', gender: 'male' }),
        makeUser({ id: 'female', gender: 'female' }),
      ]);

      const filtered = service.applyOfflineFilters(scored.data, { gender: 'female' });
      expect(filtered.data).toHaveLength(1);
      expect(filtered.data[0].partner.id).toBe('female');
    });

    it('should filter by age range', () => {
      const current = makeUser();
      const scored = service.scoreAndRank(current, [
        makeUser({ id: 'young', age: 18 }),
        makeUser({ id: 'mid', age: 30 }),
        makeUser({ id: 'old', age: 65 }),
      ]);

      const filtered = service.applyOfflineFilters(scored.data, { age_min: 20, age_max: 50 });
      expect(filtered.data).toHaveLength(1);
      expect(filtered.data[0].partner.id).toBe('mid');
    });

    it('should keep partners with unknown age when filtering', () => {
      const current = makeUser();
      const scored = service.scoreAndRank(current, [
        makeUser({ id: 'unknown-age', age: undefined }),
      ]);

      const filtered = service.applyOfflineFilters(scored.data, { age_min: 20, age_max: 50 });
      expect(filtered.data).toHaveLength(1);
    });

    it('should filter by availability', () => {
      const current = makeUser();
      const scored = service.scoreAndRank(current, [
        makeUser({
          id: 'morning',
          availability_morning: true,
          availability_afternoon: false,
          availability_evening: false,
        }),
        makeUser({
          id: 'evening',
          availability_morning: false,
          availability_afternoon: false,
          availability_evening: true,
        }),
      ]);

      const filtered = service.applyOfflineFilters(scored.data, { availability_morning: true });
      expect(filtered.data).toHaveLength(1);
      expect(filtered.data[0].partner.id).toBe('morning');
    });
  });

  describe('applyOfflineFilters - error boundary', () => {
    it('should return empty data and degraded=false for empty input', () => {
      const result = service.applyOfflineFilters([], {});
      expect(result.data).toEqual([]);
      expect(result.degraded).toBe(false);
    });

    it('should handle undefined input gracefully', () => {
      const result = service.applyOfflineFilters(undefined as unknown as never[], {});
      expect(result.data).toEqual([]);
      expect(result.degraded).toBe(false);
    });
  });

  describe('scoreAndRank - error boundary', () => {
    it('should handle null candidates gracefully', () => {
      const result = service.scoreAndRank(makeUser(), null as unknown as never[]);
      expect(result.data).toEqual([]);
      expect(result.degraded).toBe(false);
    });

    it('should mark degraded when partner scoring throws', () => {
      const current = makeUser({ native_languages: ['en'], target_languages: ['ja'] });
      const goodPartner = makeUser({ native_languages: ['ja'], target_languages: ['en'] });
      // Partner with getter that throws to simulate a truly malformed object
      const badPartner = makeUser({ native_languages: ['fr'], target_languages: ['de'] });
      Object.defineProperty(badPartner, 'learning_goals', {
        get() {
          throw new Error('Corrupt IndexedDB entry');
        },
        configurable: true,
      });

      const result = service.scoreAndRank(current, [badPartner, goodPartner]);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.length).toBe(1);
      expect(result.degraded).toBe(true);
      expect(service.lastErrorMap.has('scoreAndRank:partner')).toBe(true);
    });
  });

  describe('getMatchReasonLabel', () => {
    it('should return language exchange label for strong language matches', () => {
      const score = {
        partner: makeUser({ id: 'p1' }),
        totalScore: 85,
        breakdown: {
          languageComplementarity: 40,
          sharedInterests: 0,
          activityStreak: 0,
          seriousLearnerBonus: 0,
        },
      };

      const label = service.getMatchReasonLabel(score);
      expect(label).toBe('matchmaking.reasonLanguageExchange');
    });

    it('should return shared interests label', () => {
      const score = {
        partner: makeUser({ id: 'p1' }),
        totalScore: 60,
        breakdown: {
          languageComplementarity: 10,
          sharedInterests: 25,
          activityStreak: 0,
          seriousLearnerBonus: 0,
        },
      };

      const label = service.getMatchReasonLabel(score);
      expect(label).toBe('matchmaking.reasonSharedInterests');
    });

    it('should return serious learner label', () => {
      const score = {
        partner: makeUser({ id: 'p1' }),
        totalScore: 30,
        breakdown: {
          languageComplementarity: 5,
          sharedInterests: 0,
          activityStreak: 5,
          seriousLearnerBonus: 10,
        },
      };

      const label = service.getMatchReasonLabel(score);
      expect(label).toBe('matchmaking.reasonSeriousLearner');
    });

    it('should return general label as fallback', () => {
      const score = {
        partner: makeUser({ id: 'p1' }),
        totalScore: 5,
        breakdown: {
          languageComplementarity: 0,
          sharedInterests: 0,
          activityStreak: 0,
          seriousLearnerBonus: 0,
        },
      };

      const label = service.getMatchReasonLabel(score);
      expect(label).toBe('matchmaking.reasonGeneral');
    });

    it('should return general label when label computation throws', () => {
      const badScore = null as unknown as never;

      const label = service.getMatchReasonLabel(badScore);
      expect(label).toBe('matchmaking.reasonGeneral');
    });
  });
});
