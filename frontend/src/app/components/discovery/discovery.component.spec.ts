import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { UserService, UserProfile } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { provideRouter } from '@angular/router';

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

describe('DiscoveryComponent', () => {
  let component: DiscoveryComponent;
  let fixture: ComponentFixture<DiscoveryComponent>;
  let mockDiscoveryService: { findPartners: ReturnType<typeof vi.fn> };
  let mockUserService: {
    getMyProfile: ReturnType<typeof vi.fn>;
    updateMyProfile: ReturnType<typeof vi.fn>;
  };
  let mockSafetyService: { getBlockedIdsAsync: ReturnType<typeof vi.fn> };
  let mockAuthService: { currentUser: ReturnType<typeof signal> };

  beforeEach(async () => {
    mockDiscoveryService = {
      findPartners: vi.fn().mockResolvedValue([]),
    };
    mockUserService = {
      getMyProfile: vi.fn().mockResolvedValue(null),
      updateMyProfile: vi.fn().mockResolvedValue(undefined),
    };
    mockSafetyService = {
      getBlockedIdsAsync: vi.fn().mockResolvedValue([]),
    };
    mockAuthService = {
      currentUser: signal<{ is_vip: boolean } | null>(null),
    };

    await TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: mockDiscoveryService },
        { provide: UserService, useValue: mockUserService },
        { provide: SafetyService, useValue: mockSafetyService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryComponent);
    component = fixture.componentInstance;
  });

  async function flush(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  function init(): Promise<void> {
    return flush();
  }

  it('should create', async () => {
    await init();
    expect(component).toBeTruthy();
  });

  it('should search for partners on init', async () => {
    await init();
    // Called once directly from ngOnInit, and once more via the age range
    // slider's initial ageRangeChanged emission.
    expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(2);
    expect(component.isLoading()).toBe(false);
  });

  it('should populate target languages and restore serious learner mode from profile', async () => {
    mockUserService.getMyProfile.mockResolvedValue({
      target_languages: ['JA', 'FR'],
      is_serious_learner: true,
    });

    await init();

    expect(component.myTargetLangs().map((l) => l.code)).toEqual(['JA', 'FR']);
    expect(component.seriousLearnerMode()).toBe(true);
    expect(component.seriousLearnerOnly()).toBe(true);
    expect(component.selectedFilter()).toBe('serious');
  });

  it('should filter out blocked users from search results', async () => {
    mockDiscoveryService.findPartners.mockResolvedValue([
      makePartner({ id: 'a' }),
      makePartner({ id: 'blocked-1' }),
    ]);
    mockSafetyService.getBlockedIdsAsync.mockResolvedValue(['blocked-1']);

    await init();

    const ids = component.partners().map((p) => p.id);
    expect(ids).toEqual(['a']);
  });

  it('should not fail component init when profile loading fails', async () => {
    mockUserService.getMyProfile.mockRejectedValue(new Error('network error'));

    await init();

    expect(component.myTargetLangs()).toEqual([]);
    expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(2);
  });

  it('should set isLoading false and log when search fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDiscoveryService.findPartners.mockRejectedValue(new Error('search failed'));

    await init();

    expect(component.isLoading()).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should update filter, serious learner flag and distance when selecting "serious"', async () => {
    await init();
    mockDiscoveryService.findPartners.mockClear();

    component.onFilterSelect('serious');
    await flush();

    expect(component.selectedFilter()).toBe('serious');
    expect(component.seriousLearnerOnly()).toBe(true);
    expect(component.selectedDistanceKm()).toBe(50);
    expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(1);
  });

  it('should narrow the distance to 10km when selecting "nearby"', async () => {
    await init();

    component.onFilterSelect('nearby');
    await flush();

    expect(component.selectedDistanceKm()).toBe(10);
    expect(component.seriousLearnerOnly()).toBe(false);
  });

  it('should update the selected target language and re-search', async () => {
    await init();
    mockDiscoveryService.findPartners.mockClear();

    component.setLanguage('DE');
    await flush();

    expect(component.selectedTargetLanguage()).toBe('DE');
    expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(1);
  });

  it('should only apply gender filter for VIP users', async () => {
    await init();

    component.setGender('female');
    await flush();

    let callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.gender).toBeUndefined();

    mockAuthService.currentUser.set({ is_vip: true });
    mockDiscoveryService.findPartners.mockClear();
    component.setGender('male');
    await flush();

    callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.gender).toBe('male');
  });

  it('should update age range and re-search on age range change', async () => {
    await init();
    mockDiscoveryService.findPartners.mockClear();

    component.onAgeRangeChanged({ min: 21, max: 40 });
    await flush();

    expect(component.ageRangeMin()).toBe(21);
    expect(component.ageRangeMax()).toBe(40);
    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.age_min).toBe(21);
    expect(callArgs.age_max).toBe(40);
  });

  it('should toggle serious learner mode, persist it and re-search', async () => {
    await init();
    mockDiscoveryService.findPartners.mockClear();

    await component.toggleSeriousLearnerMode();

    expect(mockUserService.updateMyProfile).toHaveBeenCalledWith({ is_serious_learner: true });
    expect(component.seriousLearnerMode()).toBe(true);
    expect(component.seriousLearnerOnly()).toBe(true);
    expect(component.selectedFilter()).toBe('serious');
    expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(1);
  });

  it('should not change state when persisting serious learner mode fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockUserService.updateMyProfile.mockRejectedValue(new Error('update failed'));
    await init();

    await component.toggleSeriousLearnerMode();

    expect(component.seriousLearnerMode()).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should format distances under 1km in metres and miles', async () => {
    mockDiscoveryService.findPartners.mockResolvedValue([makePartner({ distance_metres: 500 })]);

    await init();

    expect(component.partners()[0].formattedDistance).toBe('500 m (0.31 mi)');
  });

  it('should format distances over 1km in kilometres and miles', async () => {
    mockDiscoveryService.findPartners.mockResolvedValue([
      makePartner({ distance_metres: 5000 }),
    ]);

    await init();

    expect(component.partners()[0].formattedDistance).toBe('5.0 km · 3.1 mi');
  });

  it('should default native and target language chips when partner has none', async () => {
    mockDiscoveryService.findPartners.mockResolvedValue([
      makePartner({ native_languages: undefined, target_languages: [] }),
    ]);

    await init();

    const partner = component.partners()[0];
    expect(partner.nativeLangs).toEqual([{ code: 'EN', level: 5 }]);
    expect(partner.targetLangs).toEqual([{ code: 'JA', level: 1 }]);
  });

  it('should reset filters and search again', async () => {
    await init();
    component.setLanguage('FR');
    component.onFilterSelect('nearby');
    component.setSort('newest');
    await flush();
    mockDiscoveryService.findPartners.mockClear();

    component.resetFilters();
    await flush();

    expect(component.selectedDistanceKm()).toBe(50);
    expect(component.selectedNativeLanguage()).toBe('');
    expect(component.selectedTargetLanguage()).toBe('');
    expect(component.seriousLearnerOnly()).toBe(false);
    expect(component.seriousLearnerMode()).toBe(false);
    expect(component.ageRangeMin()).toBe(18);
    expect(component.ageRangeMax()).toBe(100);
    expect(component.selectedSort()).toBe('best_match');
    expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(1);
  });

  it('should default to best_match sort and include it in the search call', async () => {
    await init();

    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(component.selectedSort()).toBe('best_match');
    expect(callArgs.sort).toBe('best_match');
  });

  it('should expose translated sort options', async () => {
    await init();

    expect(component.sortOptions().map((o) => o.id)).toEqual([
      'best_match',
      'online_now',
      'nearest',
      'newest',
    ]);
  });

  it('should update the selected sort and re-search when a sort option is chosen', async () => {
    await init();
    mockDiscoveryService.findPartners.mockClear();

    component.setSort('nearest');
    await flush();

    expect(component.selectedSort()).toBe('nearest');
    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.sort).toBe('nearest');
    expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(1);
  });

  it('should render a sort select bound to the selected sort option', async () => {
    await init();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#sortBySelect');
    expect(select).toBeTruthy();
    expect(select.value).toBe('best_match');

    select.value = 'newest';
    select.dispatchEvent(new Event('change'));
    await flush();

    expect(component.selectedSort()).toBe('newest');
  });
});
