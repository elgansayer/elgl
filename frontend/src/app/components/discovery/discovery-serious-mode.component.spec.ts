import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { OfflineDiscoveryCacheService } from '../../services/offline-discovery-cache.service';
import { DiscoveryOnboardingService } from '../../services/discovery-onboarding.service';
import { MatchmakingOnboardingService } from '../../services/matchmaking-onboarding.service';
import { I18nService } from '../../services/i18n.service';
import { SeriousLearnerModeService } from '../../services/serious-learner-mode.service';

describe('DiscoveryComponent serious learner mode', () => {
  let fixture: ComponentFixture<DiscoveryComponent>;
  let component: DiscoveryComponent;
  let updateMyProfile: ReturnType<typeof vi.fn<(changes: { is_serious_learner: boolean }) => Promise<void>>>;
  let findPartners: ReturnType<typeof vi.fn>;
  let seriousLearnerModeFake: Pick<
    SeriousLearnerModeService,
    'enabled' | 'saving' | 'error' | 'toggle'
  >;

  beforeEach(async () => {
    updateMyProfile = vi.fn<(changes: { is_serious_learner: boolean }) => Promise<void>>().mockResolvedValue(undefined);
    const seriousEnabled = signal(false);
    const seriousSaving = signal(false);
    const seriousError = signal<string | null>(null);
    // Mirrors SeriousLearnerModeService.toggle(): persist first, then commit, and
    // refuse concurrent writes. updateMyProfile stands in for the persisted write.
    seriousLearnerModeFake = {
      enabled: seriousEnabled,
      saving: seriousSaving,
      error: seriousError,
      async toggle(): Promise<boolean> {
        if (seriousSaving()) return false;
        const next = !seriousEnabled();
        seriousSaving.set(true);
        seriousError.set(null);
        try {
          await updateMyProfile({ is_serious_learner: next });
          seriousEnabled.set(next);
          return true;
        } catch {
          seriousError.set('save_failed');
          return false;
        } finally {
          seriousSaving.set(false);
        }
      },
    };
    findPartners = vi.fn().mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: { findPartners } },
        { provide: SeriousLearnerModeService, useValue: seriousLearnerModeFake },
        {
          provide: UserService,
          useValue: {
            updateMyProfile,
            getMyProfile: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: SafetyService,
          useValue: { getBlockedIdsAsync: vi.fn().mockResolvedValue([]) },
        },
        { provide: AuthService, useValue: { currentUser: signal(null), getAccessToken: () => undefined } },
        {
          provide: OfflineDiscoveryCacheService,
          useValue: {
            isOnline: signal(true).asReadonly(),
            cachedDataAvailable: signal(false).asReadonly(),
          },
        },
        {
          provide: DiscoveryOnboardingService,
          useValue: {
            hasCompletedTour: vi.fn().mockReturnValue(true),
            startTour: vi.fn(),
          },
        },
        {
          provide: MatchmakingOnboardingService,
          useValue: {
            startTour: vi.fn(),
            isTourInProgress: vi.fn().mockReturnValue(false),
            markComplete: vi.fn(),
          },
        },
        {
          provide: I18nService,
          useValue: {
            translations: signal({}),
            translate: vi.fn((key: string) => key),
          },
        },
      ],
    })
      .overrideComponent(DiscoveryComponent, { set: { template: '' } })
      .compileComponents();

    fixture = TestBed.createComponent(DiscoveryComponent);
    component = fixture.componentInstance;
  });

  it('persists enabling mode and applies the serious filter', async () => {
    await component.toggleSeriousLearnerMode();

    expect(updateMyProfile).toHaveBeenCalledWith({ is_serious_learner: true });
    expect(component.seriousLearnerMode()).toBe(true);
    expect(component.seriousLearnerOnly()).toBe(true);
    expect(component.selectedFilter()).toBe('serious');
    expect(component.seriousModeSaving()).toBe(false);
    expect(component.seriousModeError()).toBe(false);
    expect(findPartners).toHaveBeenCalledTimes(1);
  });

  it('removes the serious filter when persisted mode is disabled', async () => {
    component.seriousLearnerMode.set(true);
    component.seriousLearnerOnly.set(true);
    component.selectedFilter.set('serious');

    await component.toggleSeriousLearnerMode();

    expect(updateMyProfile).toHaveBeenCalledWith({ is_serious_learner: false });
    expect(component.seriousLearnerMode()).toBe(false);
    expect(component.seriousLearnerOnly()).toBe(false);
    expect(component.selectedFilter()).toBe('all');
  });

  it('keeps the previous state and exposes an error when persistence fails', async () => {
    updateMyProfile.mockRejectedValueOnce(new Error('network unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await component.toggleSeriousLearnerMode();

    expect(component.seriousLearnerMode()).toBe(false);
    expect(component.seriousLearnerOnly()).toBe(false);
    expect(component.seriousModeSaving()).toBe(false);
    expect(component.seriousModeError()).toBe(true);
    expect(findPartners).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('prevents duplicate profile mutations while a toggle is pending', async () => {
    let resolveUpdate: (() => void) | undefined;
    updateMyProfile.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    const first = component.toggleSeriousLearnerMode();
    const second = component.toggleSeriousLearnerMode();

    expect(component.seriousModeSaving()).toBe(true);
    expect(updateMyProfile).toHaveBeenCalledTimes(1);

    resolveUpdate?.();
    await Promise.all([first, second]);
    expect(component.seriousModeSaving()).toBe(false);
  });

  it('keeps persisted mode active when temporary filters are reset', () => {
    component.seriousLearnerMode.set(true);
    component.selectedFilter.set('nearby');
    component.seriousLearnerOnly.set(true);

    component.resetFilters();

    expect(component.seriousLearnerMode()).toBe(true);
    expect(component.seriousLearnerOnly()).toBe(true);
    expect(component.selectedFilter()).toBe('serious');
  });

  it('keeps persistent mode composed with another discovery pill', async () => {
    // #7575: Nearby searches only after the browser grants a precise location.
    vi.stubGlobal('navigator', {
      ...navigator,
      onLine: true,
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 51.5, longitude: -0.12 } } as GeolocationPosition),
      },
    });
    component.seriousLearnerMode.set(true);
    findPartners.mockClear();

    component.onFilterSelect('nearby');
    await vi.waitFor(() => expect(findPartners).toHaveBeenCalled());

    expect(component.selectedFilter()).toBe('nearby');
    expect(component.seriousLearnerOnly()).toBe(true);
    expect(component.selectedDistanceKm()).toBe(10);
    expect(findPartners).toHaveBeenCalledTimes(1);
  });
});
