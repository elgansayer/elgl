import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CrashReportService } from './crash-report.service';
import { I18nService } from './i18n.service';
import { MatchmakingAlgorithmService } from './matchmaking-algorithm.service';
import type { UserProfile } from './user.service';

function makeUser(id: string, overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id,
    display_name: id,
    native_languages: ['en'],
    target_languages: ['ja'],
    is_vip: false,
    vip_tier: 'free',
    coins_balance: 0,
    study_streak_days: 1,
    correction_ratio: 0,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    privacy_hide_gender: false,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('MatchmakingAlgorithmService interest filtering', () => {
  let service: MatchmakingAlgorithmService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MatchmakingAlgorithmService,
        {
          provide: CrashReportService,
          useValue: { reportCrash: () => Promise.resolve() },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    });
    service = TestBed.inject(MatchmakingAlgorithmService);
  });

  it('keeps only cached partners with the selected interest while offline', () => {
    const current = makeUser('current');
    const photo = makeUser('photo', { interests: ['Photography', 'travel'] });
    const music = makeUser('music', { interests: ['music'] });
    const scored = service.scoreAndRank(current, [photo, music]);

    const filtered = service.applyOfflineFilters(scored.data, {
      interests: ' photography ',
    });

    expect(filtered.degraded).toBe(false);
    expect(filtered.data.map((item) => item.partner.id)).toEqual(['photo']);
  });

  it('supports legacy cached hobbies while profiles converge on interests', () => {
    const current = makeUser('current');
    const legacy = makeUser('legacy', { hobbies: ['Gaming'] });
    const scored = service.scoreAndRank(current, [legacy]);

    const filtered = service.applyOfflineFilters(scored.data, {
      interests: 'gaming',
    });

    expect(filtered.data.map((item) => item.partner.id)).toEqual(['legacy']);
  });

  it('does not filter cached partners when no interest is selected', () => {
    const current = makeUser('current');
    const candidates = [
      makeUser('photo', { interests: ['photography'] }),
      makeUser('music', { interests: ['music'] }),
    ];
    const scored = service.scoreAndRank(current, candidates);

    const filtered = service.applyOfflineFilters(scored.data, {});

    expect(filtered.data).toHaveLength(2);
  });
});
