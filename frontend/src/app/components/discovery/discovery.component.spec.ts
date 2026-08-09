import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DiscoveryComponent } from './discovery.component';
import { DiscoveryService } from '../../services/discovery.service';
import { UserService, UserProfile } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { OfflineDiscoveryCacheService } from '../../services/offline-discovery-cache.service';
import { DiscoveryOnboardingService } from '../../services/discovery-onboarding.service';
import { provideRouter } from '@angular/router';

class MockAudio {
  currentTime = 0;
  src: string;
  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  load = vi.fn();
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private listeners: Record<string, (() => void)[]> = {};
  constructor(src: string) {
    this.src = src;
    audioInstances.push(this);
  }
  addEventListener(event: string, cb: () => void): void {
    (this.listeners[event] ??= []).push(cb);
  }
  removeEventListener(event: string, cb: () => void): void {
    const stack = this.listeners[event];
    if (stack) {
      this.listeners[event] = stack.filter((f) => f !== cb);
    }
  }
  emit(event: string): void {
    this.listeners[event]?.forEach((cb) => cb());
  }
  clearListeners(): void {
    this.listeners = {};
    this.onended = null;
    this.onerror = null;
  }
}

let audioInstances: MockAudio[] = [];

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

describe.skip('DiscoveryComponent', () => {
  let component: DiscoveryComponent;
  let fixture: ComponentFixture<DiscoveryComponent>;
  let mockDiscoveryService: { findPartners: ReturnType<typeof vi.fn> };
  let mockUserService: {
    getMyProfile: ReturnType<typeof vi.fn>;
    updateMyProfile: ReturnType<typeof vi.fn>;
  };
  let mockSafetyService: { getBlockedIdsAsync: ReturnType<typeof vi.fn> };
  let mockAuthService: { currentUser: ReturnType<typeof signal> };
  let mockDiscoveryOnboardingService: { startTour: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    audioInstances = [];
    vi.stubGlobal('Audio', MockAudio);

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
    mockDiscoveryOnboardingService = {
      startTour: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [DiscoveryComponent],
      providers: [
        provideRouter([]),
        { provide: DiscoveryService, useValue: mockDiscoveryService },
        { provide: UserService, useValue: mockUserService },
        { provide: SafetyService, useValue: mockSafetyService },
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: OfflineDiscoveryCacheService,
          useValue: {
            isOnline: signal(true).asReadonly(),
            cachedDataAvailable: signal(false).asReadonly(),
          },
        },
        { provide: DiscoveryOnboardingService, useValue: mockDiscoveryOnboardingService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoveryComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    audioInstances = [];
    TestBed.resetTestingModule();
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
    expect(component).toBeDefined();
  });

  it('should search for partners on init', async () => {
    await init();
    // Called once directly from ngOnInit, and once more via the age range
    // slider's initial ageRangeChanged emission.
    expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(2);
    expect(component.isLoading()).toBe(false);
  });

  it('should render skeleton loaders while loading', () => {
    fixture.detectChanges();
    const skeletons = fixture.nativeElement.querySelectorAll('app-skeleton-loader');
    expect(skeletons.length).toBeGreaterThanOrEqual(5);
  });

  it('should show empty state with reset action when no partners', async () => {
    await init();

    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();

    // Verify reset button calls resetFilters
    const resetSpy = vi.spyOn(component, 'resetFilters');
    const actionButton = fixture.nativeElement.querySelector('app-empty-state button');
    if (actionButton) {
      actionButton.click();
      expect(resetSpy).toHaveBeenCalled();
    }
  });

  it('should not show skeleton loaders after loading completes', async () => {
    await init();

    fixture.detectChanges();
    const skeletons = fixture.nativeElement.querySelectorAll('app-skeleton-loader');
    expect(skeletons.length).toBe(0);
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

  it('should set isLoading false, set hasError true and log when search fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDiscoveryService.findPartners.mockRejectedValue(new Error('search failed'));

    await init();

    expect(component.isLoading()).toBe(false);
    expect(component.hasError()).toBe(true);
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

  it('should toggle voice room active and re-search', async () => {
    await init();
    mockDiscoveryService.findPartners.mockClear();

    component.toggleVoiceRoomActive();
    await flush();

    expect(component.voiceRoomActive()).toBe(true);
    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.voice_room_active).toBe(true);

    // Toggle back
    component.toggleVoiceRoomActive();
    await flush();
    expect(component.voiceRoomActive()).toBe(false);
    const callArgs2 = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs2.voice_room_active).toBeUndefined();
  });

  it('should reset voice room active when resetting filters', async () => {
    await init();
    component.toggleVoiceRoomActive();
    await flush();
    expect(component.voiceRoomActive()).toBe(true);
    mockDiscoveryService.findPartners.mockClear();

    component.resetFilters();
    await flush();

    expect(component.voiceRoomActive()).toBe(false);
    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.voice_room_active).toBeUndefined();
  });

  it('should render voice room active toggle checkbox', async () => {
    await init();

    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector('#voiceRoomActiveCheckbox');
    expect(checkbox).toBeTruthy();
    expect(checkbox.checked).toBe(false);

    checkbox.click();
    await flush();

    expect(component.voiceRoomActive()).toBe(true);
    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.voice_room_active).toBe(true);
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

  it('should clear the selected gender when resetting filters', async () => {
    mockAuthService.currentUser.set({ is_vip: true });
    await init();
    component.setGender('female');
    await flush();

    component.resetFilters();
    await flush();

    expect(component.selectedGender()).toBe('');
  });

  it('should disable the gender select and show a VIP note for non-VIP users', async () => {
    await init();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#genderSelect');
    const vipNote = fixture.nativeElement.querySelector('#genderVipNote');

    expect(select.disabled).toBe(true);
    expect(vipNote).toBeTruthy();
  });

  it('should enable the gender select and hide the VIP note for VIP users', async () => {
    mockAuthService.currentUser.set({ is_vip: true });
    await init();

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#genderSelect');
    const vipNote = fixture.nativeElement.querySelector('#genderVipNote');

    expect(select.disabled).toBe(false);
    expect(vipNote).toBeFalsy();
  });

  it('should render distance slider for VIP users', async () => {
    mockAuthService.currentUser.set({ is_vip: true });
    await init();

    const slider = fixture.nativeElement.querySelector('app-distance-slider');
    expect(slider).toBeTruthy();
  });

  it('should show VIP upsell for distance slider when user is not VIP', async () => {
    await init();

    const slider = fixture.nativeElement.querySelector('app-distance-slider');
    expect(slider).toBeFalsy();

    // The VIP upsell links should exist (at least one for distance or gender)
    const vipLinks = fixture.nativeElement.querySelectorAll('a[routerLink="/vip"]');
    expect(vipLinks.length).toBeGreaterThanOrEqual(1);
  });

  it('should update distance and re-search when distance slider changes', async () => {
    mockAuthService.currentUser.set({ is_vip: true });
    await init();
    mockDiscoveryService.findPartners.mockClear();

    component.onDistanceChanged(75);
    await flush();

    expect(component.selectedDistanceKm()).toBe(75);
    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.radius_metres).toBe(75000);
  });

  it('should default to best_match sort and include it in the search call', async () => {
    await init();

    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(component.selectedSort()).toBe('best_match');
    expect(callArgs.sort).toBe('best_match');
  });

  it('should update distance and re-search when onDistanceChanged is called', async () => {
    await init();
    mockDiscoveryService.findPartners.mockClear();

    component.onDistanceChanged(120);
    await flush();

    expect(component.selectedDistanceKm()).toBe(120);
    const callArgs = mockDiscoveryService.findPartners.mock.calls.at(-1)?.[0];
    expect(callArgs.radius_metres).toBe(120000);
  });

  it('should not re-search when distance is unchanged', async () => {
    await init();
    expect(component.selectedDistanceKm()).toBe(50);
    mockDiscoveryService.findPartners.mockClear();

    component.onDistanceChanged(50);
    await flush();

    expect(mockDiscoveryService.findPartners).not.toHaveBeenCalled();
  });

  it('should disable the distance slider for non-VIP users', async () => {
    await init();

    const slider: HTMLInputElement = fixture.nativeElement.querySelector('#distance-range-slider');
    const vipNote = fixture.nativeElement.querySelector('#distanceVipNote');

    expect(slider.disabled).toBe(true);
    expect(vipNote).toBeTruthy();
  });

  it('should have radiogroup role on filter pills', async () => {
    await init();

    const radiogroup = fixture.nativeElement.querySelector('app-scrollable-pills [role="radiogroup"]');
    expect(radiogroup).toBeTruthy();
  });

  it('should have role="list" and accessible label on partner grid', async () => {
    mockDiscoveryService.findPartners.mockResolvedValue([makePartner({ id: '1' })]);
    await init();

    const list = fixture.nativeElement.querySelector('[role="list"]');
    expect(list).toBeTruthy();
    expect(list.getAttribute('aria-label')).toContain('partner');
  });

  it('should have aria-live status region for results count', async () => {
    mockDiscoveryService.findPartners.mockResolvedValue([makePartner({ id: '1' })]);
    await init();

    const status = fixture.nativeElement.querySelector('[role="status"][aria-live="polite"]');
    expect(status).toBeTruthy();
  });

  it('should have aria-pressed on audio intro buttons', async () => {
    mockDiscoveryService.findPartners.mockResolvedValue([
      makePartner({ id: '1', audio_intro_url: 'https://example.com/audio.mp3' }),
    ]);
    await init();

    const audioBtn = fixture.nativeElement.querySelector('button[aria-pressed]');
    expect(audioBtn).toBeTruthy();
  });

  it('should enable the distance slider and hide VIP note for VIP users', async () => {
    mockAuthService.currentUser.set({ is_vip: true });
    await init();

    const slider = fixture.nativeElement.querySelector('#distance-range-slider');
    const vipNote = fixture.nativeElement.querySelector('#distanceVipNote');

    expect(slider.disabled).toBe(false);
    expect(vipNote).toBeFalsy();
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

  describe.skip('toggleAudioIntro', () => {
    it('should play the audio intro and mark the partner as playing', async () => {
      await init();

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));

      expect(audioInstances).toHaveLength(1);
      expect(audioInstances[0].src).toBe('https://example.com/intro.mp3');
      expect(audioInstances[0].play).toHaveBeenCalled();
      expect(component.playingPartnerId()).toBe('partner-1');
    });

    it('should stop propagation of the triggering event', async () => {
      await init();
      const event = new Event('click');
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should do nothing when the partner has no audio intro url', async () => {
      await init();

      component.toggleAudioIntro('partner-1', undefined, new Event('click'));

      expect(audioInstances).toHaveLength(0);
      expect(component.playingPartnerId()).toBeNull();
    });

    it('should pause and reset playback when toggling the currently playing partner', async () => {
      await init();

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));
      const audio = audioInstances[0];
      audio.currentTime = 12;

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));

      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
      expect(component.playingPartnerId()).toBeNull();
    });

    it('should stop the previous audio and start a new one when switching partners', async () => {
      await init();

      component.toggleAudioIntro('partner-1', 'https://example.com/one.mp3', new Event('click'));
      const firstAudio = audioInstances[0];

      component.toggleAudioIntro('partner-2', 'https://example.com/two.mp3', new Event('click'));

      expect(firstAudio.pause).toHaveBeenCalled();
      expect(audioInstances).toHaveLength(2);
      expect(audioInstances[1].src).toBe('https://example.com/two.mp3');
      expect(component.playingPartnerId()).toBe('partner-2');
    });

    it('should clear the playing partner when playback ends', async () => {
      await init();

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));
      audioInstances[0].emit('ended');

      expect(component.playingPartnerId()).toBeNull();
    });

    it('should clear the playing partner when playback errors', async () => {
      await init();

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));
      audioInstances[0].emit('error');

      expect(component.playingPartnerId()).toBeNull();
    });

    it('should clear the playing partner when play() rejects', async () => {
      await init();
      audioInstances = [];
      class RejectingAudio extends MockAudio {
        override play = vi.fn().mockRejectedValue(new Error('playback blocked'));
      }
      vi.stubGlobal('Audio', RejectingAudio);

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.playingPartnerId()).toBeNull();
    });

    it('should stop audio playback when the component is destroyed', async () => {
      await init();

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));
      const audio = audioInstances[0];

      component.ngOnDestroy();

      expect(audio.pause).toHaveBeenCalled();
      expect(component.playingPartnerId()).toBeNull();
    });

    it('should remove event listeners when stopping audio to prevent memory leaks', async () => {
      await init();

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));
      const audio = audioInstances[0];
      expect(audio['listeners']['ended']).toHaveLength(1);
      expect(audio['listeners']['error']).toHaveLength(1);

      // Simulate stop via toggle with same partner
      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));

      expect(audio['listeners']['ended']).toHaveLength(0);
      expect(audio['listeners']['error']).toHaveLength(0);
    });
  });

  describe.skip('memory leak & request management', () => {
    it('should clean up audio event listeners on stop', async () => {
      await init();

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));
      const audio = audioInstances[0];
      // Verify listeners were registered
      expect(Object.keys(audio['listeners']).length).toBeGreaterThan(0);

      component.toggleAudioIntro('partner-1', 'https://example.com/intro.mp3', new Event('click'));
      // After toggling off, src should be cleared and load() called to release resources
      expect(audio.src).toBe('');
      expect(audio.load).toHaveBeenCalled();
      expect(audio.onended).toBeNull();
      expect(audio.onerror).toBeNull();
    });

    it('should cancel in-flight search when searchPartners is called again', async () => {
      await init();
      // AbortController should be created by searchPartners
      expect(component['searchAbortController']).toBeDefined();
      const firstController = component['searchAbortController'];

      // Call searchPartners again; should abort the first controller
      await component.searchPartners();
      // Previous controller should have been replaced
      expect(component['searchAbortController']).not.toBe(firstController);
    });

    it('should enable debouncing on distance changes', async () => {
      vi.useFakeTimers();
      await init();
      mockDiscoveryService.findPartners.mockClear();

      // Rapid distance changes should only result in one search after debounce
      component.onDistanceChanged(25);
      component.onDistanceChanged(50);
      component.onDistanceChanged(75);

      expect(mockDiscoveryService.findPartners).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(mockDiscoveryService.findPartners).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('should clear debounce timer on destroy', async () => {
      vi.useFakeTimers();
      await init();
      mockDiscoveryService.findPartners.mockClear();

      component.onDistanceChanged(25);
      expect(mockDiscoveryService.findPartners).not.toHaveBeenCalled();

      component.ngOnDestroy();
      vi.advanceTimersByTime(300);
      expect(mockDiscoveryService.findPartners).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe.skip('audio intro play button in the template', () => {
    it('should render a play button for partners with an audio intro', async () => {
      mockDiscoveryService.findPartners.mockResolvedValue([
        makePartner({ id: 'p1', audio_intro_url: 'https://example.com/intro.mp3' }),
      ]);

      await init();

      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        'button[aria-pressed]',
      );
      expect(button).toBeTruthy();
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('should not render a play button for partners without an audio intro', async () => {
      mockDiscoveryService.findPartners.mockResolvedValue([makePartner({ id: 'p1' })]);

      await init();

      const button = fixture.nativeElement.querySelector('button[aria-pressed]');
      expect(button).toBeFalsy();
    });

    it('should toggle aria-pressed on the play button when clicked', async () => {
      mockDiscoveryService.findPartners.mockResolvedValue([
        makePartner({ id: 'p1', audio_intro_url: 'https://example.com/intro.mp3' }),
      ]);

      await init();

      const button: HTMLButtonElement = fixture.nativeElement.querySelector(
        'button[aria-pressed]',
      );
      button.click();
      await flush();

      expect(button.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe.skip('skeleton and empty states', () => {
    it('should render skeleton cards while loading', async () => {
      mockDiscoveryService.findPartners.mockImplementation(
        () => new Promise(() => undefined),
      );
      await init();

      const skeletons = fixture.nativeElement.querySelectorAll('app-discovery-skeleton-card');
      expect(skeletons.length).toBe(6);
    });

    it('should render error empty state with retry action when search fails', async () => {
      mockDiscoveryService.findPartners.mockRejectedValue(new Error('search failed'));
      await init();

      expect(component.hasError()).toBe(true);

      const emptyState = fixture.nativeElement.querySelector('app-empty-state');
      expect(emptyState).toBeTruthy();

      const title = fixture.nativeElement.textContent || '';
      expect(title).toContain('Something went wrong');
    });

    it('should render empty state with reset action when no partners found', async () => {
      mockDiscoveryService.findPartners.mockResolvedValue([]);
      await init();

      expect(component.partners().length).toBe(0);

      const emptyState = fixture.nativeElement.querySelector('app-empty-state');
      expect(emptyState).toBeTruthy();
    });

    it('should have hasError false on successful search', async () => {
      mockDiscoveryService.findPartners.mockResolvedValue([makePartner()]);
      await init();

      expect(component.hasError()).toBe(false);
      expect(component.isLoading()).toBe(false);
    });

    it('should clear hasError when retrying after failure', async () => {
      mockDiscoveryService.findPartners
        .mockRejectedValueOnce(new Error('search failed'))
        .mockResolvedValueOnce([]);

      await init();
      expect(component.hasError()).toBe(true);

      await component.searchPartners();
      expect(component.hasError()).toBe(false);
    });
  });
});
