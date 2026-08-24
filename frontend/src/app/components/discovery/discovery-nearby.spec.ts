import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { UserService, UserProfile } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { OfflineDiscoveryCacheService } from '../../services/offline-discovery-cache.service';
import { DiscoveryOnboardingService } from '../../services/discovery-onboarding.service';
import { MatchmakingOnboardingService } from '../../services/matchmaking-onboarding.service';
import {
  BrowserGeolocationError,
  BrowserGeolocationService,
} from '../../services/browser-geolocation.service';
import { I18nService } from '../../services/i18n.service';

function partner(distanceMetres: number): UserProfile {
  return {
    id: 'nearby-partner',
    display_name: 'Nearby learner',
    native_languages: ['ja'],
    target_languages: ['en'],
    distance_metres: distanceMetres,
  } as UserProfile;
}

describe('DiscoveryComponent Nearby GPS search', () => {
  async function setup(options?: {
    online?: boolean;
    coordinates?: { latitude: number; longitude: number; capturedAt: number };
    locationError?: BrowserGeolocationError;
    results?: UserProfile[];
  }) {
    const findPartners = vi.fn().mockResolvedValue(options?.results ?? [partner(5000)]);
    const getCurrentPosition = options?.locationError
      ? vi.fn().mockRejectedValue(options.locationError)
      : vi.fn().mockResolvedValue(
          options?.coordinates ?? {
            latitude: 51.5074,
            longitude: -0.1278,
            capturedAt: Date.now(),
          },
        );
    const online = signal(options?.online ?? true);

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
            isOnline: online.asReadonly(),
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
    const startupGeolocationCalls = getCurrentPosition.mock.calls.length;
    findPartners.mockClear();
    getCurrentPosition.mockClear();
    return {
      fixture,
      component,
      findPartners,
      getCurrentPosition,
      online,
      startupGeolocationCalls,
    };
  }

  it('does not request location during ordinary component startup', async () => {
    const { startupGeolocationCalls } = await setup();

    expect(startupGeolocationCalls).toBe(0);
  });

  it('requests location only after Nearby is selected and sends a nearest spatial query', async () => {
    const { component, findPartners, getCurrentPosition } = await setup();

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(1));

    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(findPartners).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 51.5074,
        longitude: -0.1278,
        radius_metres: 10_000,
        sort: 'nearest',
      }),
      expect.any(AbortSignal),
    );
    expect(component.nearbyLocationStatus()).toBe('ready');
  });

  it('surfaces permission denial without performing an unrelated partner search', async () => {
    const { component, findPartners } = await setup({
      locationError: new BrowserGeolocationError('permission_denied'),
    });

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(component.nearbyLocationStatus()).toBe('permission_denied'));

    expect(findPartners).not.toHaveBeenCalled();
    expect(component.partners()).toEqual([]);
    expect(component.nearbyLocationNeedsAction()).toBe(true);
  });

  it('does not prompt or fall back to cached/global results while offline', async () => {
    const { component, findPartners, getCurrentPosition } = await setup({ online: false });

    component.onFilterSelect('nearby');
    await Promise.resolve();

    expect(component.nearbyLocationStatus()).toBe('offline');
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(findPartners).not.toHaveBeenCalled();
  });

  it('requires an explicit refresh when an in-memory location is stale', async () => {
    const { component, findPartners } = await setup({
      coordinates: {
        latitude: 51.5074,
        longitude: -0.1278,
        capturedAt: Date.now() - 6 * 60 * 1000,
      },
    });

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(component.nearbyLocationStatus()).toBe('stale'));

    expect(findPartners).not.toHaveBeenCalled();
    expect(component.nearbyLocationNeedsAction()).toBe(true);
  });

  it('drops non-spatial fallback rows from Nearby results', async () => {
    const { component, findPartners } = await setup({
      results: [{ ...partner(1000), distance_metres: undefined } as UserProfile],
    });

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(1));

    expect(component.partners()).toEqual([]);
  });

  it('renders one locale-appropriate privacy-rounded distance unit', async () => {
    const { component, findPartners } = await setup({ results: [partner(5000)] });
    const i18n = TestBed.inject(I18nService);
    i18n.currentLang.set('en-US');

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalledTimes(1));
    expect(component.partners()[0].formattedDistance).toMatch(/ mi$/);
    expect(component.partners()[0].formattedDistance).not.toContain('km');

    i18n.currentLang.set('ja');
    await component.searchPartners();
    expect(component.partners()[0].formattedDistance).toMatch(/ km$/);
    expect(component.partners()[0].formattedDistance).not.toContain('mi');
  });
});
