import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryComponent } from './discovery.component';
import { DiscoverySearchError, DiscoveryService } from '../../services/discovery.service';
import { UserProfile, UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { OfflineDiscoveryCacheService } from '../../services/offline-discovery-cache.service';
import { DiscoveryOnboardingService } from '../../services/discovery-onboarding.service';
import { MatchmakingOnboardingService } from '../../services/matchmaking-onboarding.service';
import { SeriousLearnerModeService } from '../../services/serious-learner-mode.service';

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
  let fixture: ComponentFixture<DiscoveryComponent>;
  let findPartners: ReturnType<typeof vi.fn>;
  let currentUser: ReturnType<typeof signal<{ is_vip: boolean } | null>>;
  let seriousLearnerMode: ReturnType<typeof signal<boolean>>;
  let setSeriousLearnerMode: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    findPartners = vi.fn().mockResolvedValue([]);
    currentUser = signal<{ is_vip: boolean } | null>(null);
    seriousLearnerMode = signal(false);
    setSeriousLearnerMode = vi.fn(async (next: boolean) => {
      seriousLearnerMode.set(next);
      return true;
    });

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
          provide: SeriousLearnerModeService,
          useValue: {
            enabled: seriousLearnerMode.asReadonly(),
            saving: signal(false).asReadonly(),
            error: signal<string | null>(null).asReadonly(),
            refresh: vi.fn().mockResolvedValue(undefined),
            setEnabled: setSeriousLearnerMode,
          },
        },
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

    fixture = TestBed.createComponent(DiscoveryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // ngOnInit() fires fire-and-forget and ends with its own searchPartners()
    // call once profile/blocked-user loading resolves. Flush it here so it
    // can't land findPartners calls mid-test after a mockClear().
    await flushPromises();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  async function flushPromises(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  it('passes distance, native language, target language and Serious Learner criteria to discovery', async () => {
    currentUser.set({ is_vip: true });
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

  it('applies and clears every global search filter before re-searching', async () => {
    findPartners.mockClear();

    component.onGlobalSearch({
      native_languages: 'es',
      target_language: 'ja',
      proficiency_level: 'b2',
      has_audio_intro: true,
    });
    await flushPromises();

    expect(component.selectedNativeLanguage()).toBe('es');
    expect(component.selectedTargetLanguage()).toBe('ja');
    expect(component.selectedProficiencyLevel()).toBe('b2');
    expect(component.hasAudioIntroOnly()).toBe(true);
    expect(findPartners).toHaveBeenCalledTimes(1);

    component.onGlobalSearch({
      native_languages: '',
      target_language: '',
      proficiency_level: '',
      has_audio_intro: false,
    });
    await flushPromises();

    expect(component.selectedNativeLanguage()).toBe('');
    expect(component.selectedTargetLanguage()).toBe('');
    expect(component.selectedProficiencyLevel()).toBe('');
    expect(component.hasAudioIntroOnly()).toBe(false);
    expect(findPartners).toHaveBeenCalledTimes(2);
  });

  it('does not apply the disabled VIP radius to ordinary free discovery', async () => {
    await component.searchPartners();

    expect(findPartners).toHaveBeenLastCalledWith(
      expect.objectContaining({ radius_metres: undefined }),
      expect.anything(),
    );
  });

  it('wires rendered distance, language and Serious Learner controls into the search request', async () => {
    currentUser.set({ is_vip: true });
    fixture.detectChanges();
    findPartners.mockClear();

    const distance: HTMLInputElement = fixture.nativeElement.querySelector(
      'app-distance-slider input[type="range"]',
    );
    distance.value = '80';
    distance.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() =>
      expect(findPartners).toHaveBeenLastCalledWith(
        expect.objectContaining({ radius_metres: 80_000 }),
        expect.any(AbortSignal),
      ),
    );

    const languageTrigger: HTMLButtonElement = fixture.nativeElement.querySelector(
      'app-language-picker button[aria-haspopup="dialog"]',
    );
    languageTrigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const french: HTMLButtonElement | null = document.querySelector(
      '[role="dialog"] button[aria-label="French"]',
    );
    expect(french).toBeTruthy();
    french?.click();
    await vi.waitFor(() =>
      expect(findPartners).toHaveBeenLastCalledWith(
        expect.objectContaining({ target_language: 'fr' }),
        expect.any(AbortSignal),
      ),
    );

    const serious: HTMLElement = fixture.nativeElement.querySelector('#seriousModeCheckbox');
    serious.click();
    await vi.waitFor(() =>
      expect(findPartners).toHaveBeenLastCalledWith(
        expect.objectContaining({ serious_learner_only: true }),
        expect.any(AbortSignal),
      ),
    );
  });

  it('renders the search failure and retries from its action control', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    findPartners.mockClear();
    findPartners.mockRejectedValueOnce(new DiscoverySearchError('unavailable', 503));

    await component.searchPartners();
    fixture.detectChanges();

    const retry: HTMLButtonElement = fixture.nativeElement.querySelector('app-empty-state button');
    expect(retry).toBeTruthy();
    findPartners.mockResolvedValueOnce([]);
    retry.click();

    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(2));
    expect(component.hasError()).toBe(false);
  });

  it('renders missing profile data without inventing languages or a remote avatar', async () => {
    findPartners.mockResolvedValueOnce([
      makePartner({ avatar_url: undefined, native_languages: [], target_languages: [] }),
    ]);

    await component.searchPartners();
    fixture.detectChanges();

    expect(component.partners()[0].nativeLangs).toEqual([]);
    expect(component.partners()[0].targetLangs).toEqual([]);
    const avatar: HTMLImageElement = fixture.nativeElement.querySelector('article img');
    expect(avatar.getAttribute('src')).toBe('/assets/default-avatar.png');
  });

  it('uses the local avatar asset when an API avatar cannot be loaded', async () => {
    findPartners.mockResolvedValueOnce([
      makePartner({ avatar_url: 'https://media.example.test/unavailable-avatar.png' }),
    ]);

    await component.searchPartners();
    fixture.detectChanges();

    const avatar: HTMLImageElement = fixture.nativeElement.querySelector('article img');
    avatar.dispatchEvent(new Event('error'));

    expect(avatar.getAttribute('src')).toBe('/assets/default-avatar.png');
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

  it('omits the requirement instead of requesting profiles without intros when unchecked', async () => {
    component.onGlobalSearch({
      has_audio_intro: false,
    });
    await flushPromises();

    expect(component.hasAudioIntroOnly()).toBe(false);
    expect(findPartners).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ has_audio_intro: expect.anything() }),
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

  it('exposes a sanitised rate-limit state when partner search rejects', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    findPartners.mockRejectedValue(new DiscoverySearchError('rate_limited', 429));

    await component.searchPartners();

    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(true);
    expect(component.searchError()).toBeTruthy();
    expect(component.searchFailure()).toBe('rate_limited');
    expect(component.searchErrorDescriptionKey()).toBe('discovery.searchErrorRateLimited');
    expect(component.searchErrorActionKey()).toBe('discovery.searchErrorAction');
    expect(consoleError).toHaveBeenCalledWith('Partner search failed', {
      kind: 'rate_limited',
      status: 429,
    });
  });

  it('resets invalid filters instead of retrying an identical request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    findPartners.mockRejectedValueOnce(new DiscoverySearchError('invalid_request', 400));

    await component.searchPartners();

    expect(component.searchErrorDescriptionKey()).toBe('discovery.searchErrorInvalid');
    expect(component.searchErrorActionKey()).toBe('discovery.noResultsAction');

    const reset = vi.spyOn(component, 'resetFilters').mockImplementation(() => undefined);
    component.resolveSearchError();
    expect(reset).toHaveBeenCalledOnce();
  });

  it('uses an internationalised display name when a profile language has no dictionary key', () => {
    component.myTargetLangs.set([{ code: 'sv', flag: '🇸🇪', labelKey: 'lang.sv' }]);

    expect(component.targetLanguageChips()[0].label).not.toBe('lang.sv');
  });

  it('rolls the Serious Learner checkbox state back when persistence fails', async () => {
    setSeriousLearnerMode.mockResolvedValueOnce(false);
    component.searchFailure.set('invalid_request');
    component.searchError.set('existing search failure');

    await component.toggleSeriousLearnerMode();

    expect(setSeriousLearnerMode).toHaveBeenCalledWith(true);
    expect(component.seriousLearnerMode()).toBe(false);
    expect(component.searchFailure()).toBe('invalid_request');
    expect(component.searchError()).toBe('existing search failure');
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
