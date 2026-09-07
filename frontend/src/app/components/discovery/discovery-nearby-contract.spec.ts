import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { UserProfile, UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { OfflineDiscoveryCacheService } from '../../services/offline-discovery-cache.service';
import { DiscoveryOnboardingService } from '../../services/discovery-onboarding.service';
import { MatchmakingOnboardingService } from '../../services/matchmaking-onboarding.service';
import { BrowserGeolocationService } from '../../services/browser-geolocation.service';
import { I18nService } from '../../services/i18n.service';

function partner(distanceMetres: number): UserProfile {
  return {
    id: 'nearby-partner',
    display_name: 'Nearby learner',
    native_languages: ['ja'],
    target_languages: ['en'],
    distance_metres: distanceMetres,
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
    created_at: '2026-01-01T00:00:00.000Z',
  };
}

describe('Discovery Nearby GPS product contract', () => {
  async function setup(distanceMetres = 5_000) {
    const findPartners = vi.fn().mockResolvedValue([partner(distanceMetres)]);
    const getCurrentPosition = vi.fn().mockResolvedValue({
      latitude: 51.5074,
      longitude: -0.1278,
      capturedAt: Date.now(),
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
        { provide: AuthService, useValue: { currentUser: signal(null), getAccessToken: vi.fn() } },
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
        { provide: BrowserGeolocationService, useValue: { getCurrentPosition } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DiscoveryComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    findPartners.mockClear();
    return { fixture, component, findPartners, getCurrentPosition };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('requests GPS only after Nearby is selected and issues a bounded nearest query', async () => {
    const { component, findPartners, getCurrentPosition } = await setup();

    expect(getCurrentPosition).not.toHaveBeenCalled();

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(1));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(findPartners).toHaveBeenLastCalledWith(
      expect.objectContaining({
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 10_000,
        sort: 'nearest',
      }),
      expect.any(AbortSignal),
    );
  });

  it('renders one locale-appropriate approximate distance unit', async () => {
    const { component, findPartners } = await setup(5_000);
    const i18n = TestBed.inject(I18nService);
    i18n.currentLang.set('en-GB');

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(1));

    expect(component.partners()[0].formattedDistance).toMatch(/ mi$/);
    expect(component.partners()[0].formattedDistance).not.toContain('km');

    i18n.currentLang.set('ja');
    await component.searchPartners();

    expect(component.partners()[0].formattedDistance).toMatch(/ km$/);
    expect(component.partners()[0].formattedDistance).not.toContain('mi');
  });

  it('privacy-rounds sub-kilometre metric distances instead of exposing raw GPS precision', async () => {
    const { component, findPartners } = await setup(421);
    const i18n = TestBed.inject(I18nService);
    i18n.currentLang.set('ja');

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(1));

    expect(component.partners()[0].formattedDistance).toBe('400 m');
    expect(component.partners()[0].formattedDistance).not.toContain('421');
  });

  it('privacy-rounds sub-mile imperial distances instead of exposing raw GPS precision', async () => {
    const { component, findPartners } = await setup(421);
    const i18n = TestBed.inject(I18nService);
    i18n.currentLang.set('en-GB');

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(1));

    expect(component.partners()[0].formattedDistance).toBe('1,500 ft');
    expect(component.partners()[0].formattedDistance).not.toContain('421');
  });

  it('drops precise coordinates as soon as the learner leaves Nearby', async () => {
    const { component, findPartners } = await setup();

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(1));

    component.onFilterSelect('all');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(2));

    expect(findPartners).toHaveBeenLastCalledWith(
      expect.objectContaining({ latitude: undefined, longitude: undefined }),
      expect.any(AbortSignal),
    );
  });
});
