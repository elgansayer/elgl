import type { Mock } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { MediaService } from '../media/media.service';
import { UserProfile } from './interfaces/user-profile.interface';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'target-user',
    display_name: 'Target User',
    native_languages: ['en'],
    target_languages: ['ja'],
    is_vip: true,
    vip_tier: 'consumer',
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
    privacy_hide_online_status: true,
    privacy_hide_vip_status: true,
    last_active_at: '2026-08-20T20:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('UsersController member visibility', () => {
  const getProfile = vi.fn();
  const getUserStats = vi.fn();
  let controller: UsersController;

  beforeEach(() => {
    vi.clearAllMocks();
    const usersService = {
      getProfile,
      getUserStats,
    } as unknown as UsersService;
    controller = new UsersController(usersService, {} as MediaService);
  });

  it('masks hidden presence and VIP entitlement for another member', async () => {
    const persisted = makeProfile();
    (getProfile as Mock).mockResolvedValue(persisted);

    const result = await controller.getUserProfile(
      'target-user',
      { id: 'viewer-user' } as User,
    );

    expect(result.is_vip).toBe(false);
    expect(result.vip_tier).toBe('');
    expect(result.last_active_at).toBeUndefined();
    expect(persisted.is_vip).toBe(true);
    expect(persisted.vip_tier).toBe('consumer');
    expect(persisted.last_active_at).toBe('2026-08-20T20:00:00.000Z');
  });

  it('preserves entitlement and presence for the account owner', async () => {
    const persisted = makeProfile();
    (getProfile as Mock).mockResolvedValue(persisted);

    const result = await controller.getUserProfile(
      'target-user',
      { id: 'target-user' } as User,
    );

    expect(result.is_vip).toBe(true);
    expect(result.vip_tier).toBe('consumer');
    expect(result.last_active_at).toBe('2026-08-20T20:00:00.000Z');
  });

  it('keeps public values when the privacy controls are disabled', async () => {
    const persisted = makeProfile({
      privacy_hide_online_status: false,
      privacy_hide_vip_status: false,
    });
    (getProfile as Mock).mockResolvedValue(persisted);

    const result = await controller.getUserProfile(
      'target-user',
      { id: 'viewer-user' } as User,
    );

    expect(result.is_vip).toBe(true);
    expect(result.vip_tier).toBe('consumer');
    expect(result.last_active_at).toBe('2026-08-20T20:00:00.000Z');
  });

  it('applies the same masking to the public stats endpoint', async () => {
    (getUserStats as Mock).mockResolvedValue(
      makeProfile({
        followers_count: 12,
        following_count: 4,
      }),
    );

    const result = await controller.getUserStats(
      'target-user',
      { id: 'viewer-user' } as User,
    );

    expect(result.is_vip).toBe(false);
    expect(result.vip_tier).toBe('');
    expect(result.last_active_at).toBeUndefined();
    expect(result.followers_count).toBe(12);
  });
});
