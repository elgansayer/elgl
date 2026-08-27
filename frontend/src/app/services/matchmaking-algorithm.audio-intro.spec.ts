import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { CrashReportService } from './crash-report.service';
import { I18nService } from './i18n.service';
import {
  MatchmakingAlgorithmService,
  PartnerScore,
} from './matchmaking-algorithm.service';
import { UserProfile } from './user.service';

function scoredPartner(
  id: string,
  audioIntroUrl?: string | null,
): PartnerScore {
  return {
    partner: {
      id,
      audio_intro_url: audioIntroUrl,
    } as UserProfile,
    totalScore: 0,
    breakdown: {
      languageComplementarity: 0,
      sharedInterests: 0,
      activityStreak: 0,
      seriousLearnerBonus: 0,
    },
  };
}

describe('MatchmakingAlgorithmService audio intro offline filter', () => {
  let service: MatchmakingAlgorithmService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MatchmakingAlgorithmService,
        {
          provide: CrashReportService,
          useValue: {
            reportCrash: (): Promise<void> => Promise.resolve(),
          },
        },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
          },
        },
      ],
    });

    service = TestBed.inject(MatchmakingAlgorithmService);
  });

  it('keeps only partners with a usable audio intro when required', () => {
    const scored = [
      scoredPartner('missing'),
      scoredPartner('null', null),
      scoredPartner('empty', ''),
      scoredPartner('whitespace', '   '),
      scoredPartner('valid', 'https://cdn.example.test/intros/valid.mp3'),
    ];

    const result = service.applyOfflineFilters(scored, {
      has_audio_intro: true,
    });

    expect(result.degraded).toBe(false);
    expect(result.data.map((item) => item.partner.id)).toEqual(['valid']);
  });

  it('does not constrain offline results when the requirement is disabled or omitted', () => {
    const scored = [
      scoredPartner('missing'),
      scoredPartner('valid', 'https://cdn.example.test/intros/valid.mp3'),
    ];

    expect(
      service
        .applyOfflineFilters(scored, { has_audio_intro: false })
        .data.map((item) => item.partner.id),
    ).toEqual(['missing', 'valid']);
    expect(
      service.applyOfflineFilters(scored, {}).data.map((item) => item.partner.id),
    ).toEqual(['missing', 'valid']);
  });
});
