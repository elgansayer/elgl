import { describe, expect, it, vi } from 'vitest';
import { DiscoveryController } from './discovery.controller';
import { DiscoveryService } from './discovery.service';
import { DiscoveryDegradationService } from './discovery-degradation.service';
import { SearchQueryDto } from './dto/search-query.dto';
import { UsersService } from '../users/users.service';
import { UserProfile } from '../users/interfaces/user-profile.interface';

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    native_languages: ['en'],
    target_languages: ['ja'],
    is_vip: false,
    vip_tier: 'free',
    coins_balance: 0,
    study_streak_days: 0,
    correction_ratio: 0,
    is_serious_learner: false,
    privacy_hide_age: false,
    privacy_hide_location: false,
    privacy_hide_from_search: false,
    matchmaking_consent: true,
    privacy_hide_gender: false,
    privacy_hide_exact_location: false,
    privacy_hide_online_status: false,
    privacy_hide_vip_status: false,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('DiscoveryController Serious Learner mode', () => {
  function setup(currentProfile: UserProfile) {
    const discoveryService = {
      searchPartnersWithDegradation: vi.fn().mockResolvedValue({
        data: [],
        marker: { degraded: false, fallbackSource: 'none' },
      }),
      getAudioIntros: vi.fn().mockResolvedValue([]),
    };
    const usersService = {
      getProfile: vi.fn().mockResolvedValue(currentProfile),
    };
    const degradationService = {};

    const controller = new DiscoveryController(
      discoveryService as unknown as DiscoveryService,
      usersService as unknown as UsersService,
      degradationService as unknown as DiscoveryDegradationService,
    );

    return { controller, discoveryService };
  }

  it('forces the high-intent cohort from the persisted mode preference before partner search', async () => {
    const { controller, discoveryService } = setup(
      profile({ serious_learner_mode: true, is_serious_learner: false }),
    );
    const query = new SearchQueryDto();

    await controller.findPartners({ id: 'user-1' } as never, query);

    expect(query.serious_learner_mode).toBe(true);
    expect(query.serious_learner_only).toBe(true);
    expect(discoveryService.searchPartnersWithDegradation).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ serious_learner_mode: true }),
      query,
    );
  });

  it('does not confuse earned serious-learner qualification with the product mode preference', async () => {
    const { controller } = setup(
      profile({ serious_learner_mode: false, is_serious_learner: true }),
    );
    const query = new SearchQueryDto();

    await controller.findPartners({ id: 'user-1' } as never, query);

    expect(query.serious_learner_mode).not.toBe(true);
    expect(query.serious_learner_only).not.toBe(true);
  });

  it('applies the persisted mode to audio-intro discovery as well', async () => {
    const { controller, discoveryService } = setup(profile({ serious_learner_mode: true }));
    const query = new SearchQueryDto();

    await controller.getAudioIntros({ id: 'user-1' } as never, query);

    expect(query.serious_learner_mode).toBe(true);
    expect(query.serious_learner_only).toBe(true);
    expect(discoveryService.getAudioIntros).toHaveBeenCalledWith(
      'user-1',
      expect.any(Object),
      query,
    );
  });
});
