import { UserProfile, BusinessCatalogItem } from './user-profile.interface';

describe('UserProfile interface', () => {
  it('should define required fields on a valid profile', () => {
    const profile: UserProfile = {
      id: '123',
      native_languages: ['en-GB'],
      target_languages: ['fr'],
      is_vip: false,
      vip_tier: 'none',
      coins_balance: 0,
      study_streak_days: 0,
      correction_ratio: 0,
      is_serious_learner: false,
      privacy_hide_age: false,
      privacy_hide_location: false,
      privacy_hide_from_search: false,
      privacy_hide_gender: false,
      privacy_hide_exact_location: false,
      privacy_hide_online_status: false,
      privacy_hide_vip_status: false,
      created_at: '2026-08-02T00:00:00.000Z',
    };

    expect(profile).toBeDefined();
    expect(profile).toHaveProperty('id');
    expect(profile).toHaveProperty('native_languages');
    expect(profile).toHaveProperty('target_languages');
    expect(profile).toHaveProperty('is_vip');
    expect(profile).toHaveProperty('created_at');
    expect(profile.native_languages).toEqual(['en-GB']);
  });

  it('should allow optional fields to be omitted', () => {
    const minimal: UserProfile = {
      id: 'minimal-user',
      native_languages: [],
      target_languages: [],
      is_vip: false,
      vip_tier: 'none',
      coins_balance: 0,
      study_streak_days: 0,
      correction_ratio: 0,
      is_serious_learner: false,
      privacy_hide_age: false,
      privacy_hide_location: false,
      privacy_hide_from_search: false,
      privacy_hide_gender: false,
      privacy_hide_exact_location: false,
      privacy_hide_online_status: false,
      privacy_hide_vip_status: false,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    expect(minimal).toBeDefined();
    expect(minimal.id).toBe('minimal-user');
    expect(minimal.display_name).toBeUndefined();
    expect(minimal.bio_text).toBeUndefined();
  });

  it('should support business catalog items with optional id', () => {
    const item: BusinessCatalogItem = {
      name: 'Premium Coaching',
      description: 'One to one session',
      price: '50',
      currency: 'UKP',
    };

    expect(item).toBeDefined();
    expect(item).toHaveProperty('name');
    expect(item.id).toBeUndefined();
  });
});
