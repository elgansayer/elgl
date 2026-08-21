import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { UserProfile, UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { OfflineDiscoveryCacheService } from '../../services/offline-discovery-cache.service';
import { DiscoveryOnboardingService } from '../../services/discovery-onboarding.service';
import { MatchmakingOnboardingService } from '../../services/matchmaking-onboarding.service';

function makePartner(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'partner-1',
    display_name: 'Kenji',
    native_languages: ['JA'],
    target_languages: ['EN'],
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
    ...overrides,
  } as UserProfile;
}

describe('DiscoveryComponent matchmaking filter contract', () => {
  let component: DiscoveryComponent;
  let findPartners: ReturnType<typeof vi.fn>;
  let currentUser: ReturnType<typeof signal<{ is_vip: boolean } | null>>;

  beforeEach(async () => {
    findPartners = vi.fn().mockResolvedValue([]);
    currentUser = signal<{ is_vip: boolean } | null>(null);

    await TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: { findPartners } },
        {
          provide: UserService,
          useValue: {
            getMyProfile: vi.fn().mockResolvedValue(null),
            updateMyProfile: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: SafetyService, useValue: { getBlockedIdsAsync: vi.fn().mockResolvedValue([]) } },
        { provide: AuthService, useValue: { currentUser } },
        {
          provide: OfflineDiscoveryCacheService,
          useValue: {
            isOnline: signal(true).asReadonly(),
            cachedDataAvailable: signal(false).asReadonly(),
          },
        },
        {
          provide: DiscoveryOnboardingService,
          useValue: { hasCompletedTour: signal(true), startTour: vi.fn() },
        },
        {
          provide: MatchmakingOnboardingService,
          useValue: {
            startTour: vi.fn(),
            isTourInProgress: vi.fn().mockReturnValue(false),
            markComplete: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    component = TestBed.createComponent(DiscoveryComponent).componentInstance;
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  async function flushPromises(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  it('passes distance, native language, target language and Serious Learner criteria to discovery', async () => {
    component.selectedDistanceKm.set(100);
    component.selectedNativeLanguage.set('JA');
    component.selectedTargetLanguage.set('EN');
    component.seriousLearnerOnly.set(true);

    await component.searchPartners();

    expect(findPartners).toHaveBeenCalledWith(
      expect.objectContaining({
        radius_metres: 100_000,
        native_languages: 'JA',
        target_language: 'EN',
        serious_learner_only: true,
      }),
      expect.anything(),
    );
  });

  it('maps the shared language search output into the canonical discovery query', async () => {
    component.onGlobalSearch({
      native_languages: 'FR',
      target_language: 'DE',
      proficiency_level: 'b1',
      has_audio_intro: true,
    });
    await flushPromises();

    expect(component.selectedNativeLanguage()).toBe('FR');
    expect(component.selectedTargetLanguage()).toBe('DE');
    expect(component.selectedProficiencyLevel()).toBe('b1');
    expect(component.hasAudioIntroOnly()).toBe(true);
    expect(findPartners).toHaveBeenLastCalledWith(
      expect.objectContaining({
        native_languages: 'FR',
        target_language: 'DE',
        proficiency_level: 'b1',
        has_audio_intro: true,
      }),
      expect.anything(),
    );
  });

  it('switches the Serious Learner filter without changing language criteria', async () => {
    component.selectedNativeLanguage.set('JA');
    component.selectedTargetLanguage.set('EN');

    component.onFilterSelect('serious');
    await flushPromises();

    expect(component.selectedFilter()).toBe('serious');
    expect(component.seriousLearnerOnly()).toBe(true);
    expect(component.selectedNativeLanguage()).toBe('JA');
    expect(component.selectedTargetLanguage()).toBe('EN');
    expect(findPartners).toHaveBeenLastCalledWith(
      expect.objectContaining({
        serious_learner_only: true,
        native_languages: 'JA',
        target_language: 'EN',
      }),
      expect.anything(),
    );
  });

  it('does not send a gender filter for free users and does for VIP users', async () => {
    component.selectedGender.set('female');
    await component.searchPartners();
    expect(findPartners).toHaveBeenLastCalledWith(
      expect.objectContaining({ gender: undefined }),
      expect.anything(),
    );

    currentUser.set({ is_vip: true });
    component.selectedGender.set('male');
    await component.searchPartners();
    expect(findPartners).toHaveBeenLastCalledWith(
      expect.objectContaining({ gender: 'male' }),
      expect.anything(),
    );
  });

  it('filters blocked users before exposing search results', async () => {
    findPartners.mockResolvedValue([
      makePartner({ id: 'allowed' }),
      makePartner({ id: 'blocked' }),
    ]);
    component.blockedUserIds.set(['blocked']);

    await component.searchPartners();

    expect(component.partners().map((partner) => partner.id)).toEqual(['allowed']);
  });

  it('exposes a retryable unavailable state when partner search rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    findPartners.mockRejectedValue(new Error('provider unavailable'));

    await component.searchPartners();

    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(true);
    expect(component.searchError()).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();
  });

  it('resets matchmaking filters and executes one fresh search', async () => {
    component.selectedDistanceKm.set(250);
    component.selectedNativeLanguage.set('JA');
    component.selectedTargetLanguage.set('EN');
    component.selectedProficiencyLevel.set('c1');
    component.seriousLearnerOnly.set(true);
    component.ageRangeMin.set(25);
    component.ageRangeMax.set(45);
    component.selectedInterests.set('travel');
    findPartners.mockClear();

    component.resetFilters();
    await flushPromises();

    expect(component.selectedDistanceKm()).toBe(50);
    expect(component.selectedNativeLanguage()).toBe('');
    expect(component.selectedTargetLanguage()).toBe('');
    expect(component.selectedProficiencyLevel()).toBe('');
    expect(component.seriousLearnerOnly()).toBe(false);
    expect(component.ageRangeMin()).toBe(18);
    expect(component.ageRangeMax()).toBe(100);
    expect(component.selectedInterests()).toBe('');
    expect(findPartners).toHaveBeenCalledTimes(1);
  });

  it('keeps newer results when a superseded request resolves later', async () => {
    let resolveFirst: (partners: UserProfile[]) => void = () => undefined;
    const firstResult = new Promise<UserProfile[]>((resolve) => {
      resolveFirst = resolve;
    });
    findPartners
      .mockImplementationOnce(() => firstResult)
      .mockResolvedValueOnce([makePartner({ id: 'latest' })]);

    const firstSearch = component.searchPartners();
    const secondSearch = component.searchPartners();
    await secondSearch;
    resolveFirst([makePartner({ id: 'stale' })]);
    await firstSearch;

    expect(component.partners().map((partner) => partner.id)).toEqual(['latest']);
  });
});
