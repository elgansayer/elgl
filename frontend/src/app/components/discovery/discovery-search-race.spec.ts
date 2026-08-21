import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { OfflineDiscoveryCacheService } from '../../services/offline-discovery-cache.service';
import { DiscoveryOnboardingService } from '../../services/discovery-onboarding.service';
import { MatchmakingOnboardingService } from '../../services/matchmaking-onboarding.service';

describe('DiscoveryComponent search ownership', () => {
  it('keeps loading active when an older search finishes after its replacement starts', async () => {
    let resolveFirst: (partners: []) => void = () => undefined;
    let resolveSecond: (partners: []) => void = () => undefined;
    const firstResult = new Promise<[]>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResult = new Promise<[]>((resolve) => {
      resolveSecond = resolve;
    });
    const findPartners = vi
      .fn()
      .mockImplementationOnce(() => firstResult)
      .mockImplementationOnce(() => secondResult);

    await TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: { findPartners } },
        { provide: UserService, useValue: {} },
        { provide: SafetyService, useValue: {} },
        { provide: AuthService, useValue: { currentUser: signal(null) } },
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
        { provide: MatchmakingOnboardingService, useValue: {} },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DiscoveryComponent);
    const component = fixture.componentInstance;
    const firstSearch = component.searchPartners();
    const secondSearch = component.searchPartners();

    resolveFirst([]);
    await firstSearch;
    expect(component.isLoading()).toBe(true);

    resolveSecond([]);
    await secondSearch;
    expect(component.isLoading()).toBe(false);
  });
});
