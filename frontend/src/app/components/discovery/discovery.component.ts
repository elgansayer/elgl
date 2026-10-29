import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { HlmButton } from '@spartan-ng/helm/button';
import {
  Component,
  inject,
  signal,
  computed,
  effect,
  OnInit,
  OnDestroy,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import {
  DiscoverySearchError,
  DiscoverySearchFailureKind,
  DiscoveryService,
} from '../../services/discovery.service';
import { UserProfile, UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';
import { SeriousLearnerModeService } from '../../services/serious-learner-mode.service';
import { OfflineDiscoveryCacheService } from '../../services/offline-discovery-cache.service';
import { DiscoveryOnboardingService } from '../../services/discovery-onboarding.service';
import { MatchmakingOnboardingService } from '../../services/matchmaking-onboarding.service';
import {
  BrowserCoordinates,
  BrowserGeolocationError,
  BrowserGeolocationService,
} from '../../services/browser-geolocation.service';

import { ScrollablePillsComponent } from '../primitives/scrollable-pills/scrollable-pills.component';
import { FluencyIndicatorComponent } from '../primitives/fluency-indicator/fluency-indicator.component';
import { AppGradientButtonComponent } from '../primitives/gradient-button/gradient-button.component';
import {
  LanguagePickerComponent,
  getLanguageFlag,
} from '../primitives/language-picker/language-picker.component';
import { GlobalSearchComponent } from './global-search/global-search.component';
import { RouterLink } from '@angular/router';
import { AgeRangeSliderComponent, AgeRange } from '../age-range-slider/age-range-slider.component';
import { DistanceSliderComponent } from '../distance-slider/distance-slider.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { DiscoverySkeletonCardComponent } from './discovery-skeleton-card.component';
import { DiscoveryMapErrorBoundaryComponent } from './discovery-map-error-boundary.component';
import { DiscoveryErrorBoundaryComponent } from '../discovery-error-boundary/discovery-error-boundary.component';
import { SanitiseHtmlPipe } from '../../pipes/sanitise-html.pipe';

/** Milliseconds to debounce partner search calls triggered by interaction changes. */
const SEARCH_DEBOUNCE_MS = 300;
const NEARBY_RADIUS_KM = 10;
const NEARBY_COORDINATE_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_AVATAR_URL = '/assets/default-avatar.png';

type NearbyLocationStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'stale'
  | 'offline'
  | 'unsupported'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout';

@Component({
  selector: 'app-discovery',
  imports: [
    HlmCheckbox,
    HlmNativeSelect,
    HlmButton,
    FormsModule,
    TranslatePipe,
    ScrollablePillsComponent,
    FluencyIndicatorComponent,
    AppGradientButtonComponent,
    LanguagePickerComponent,
    GlobalSearchComponent,
    RouterLink,
    AgeRangeSliderComponent,
    DistanceSliderComponent,
    AppEmptyStateComponent,
    DiscoverySkeletonCardComponent,
    DiscoveryMapErrorBoundaryComponent,
    DiscoveryErrorBoundaryComponent,
    SanitiseHtmlPipe,
  ],
  templateUrl: './discovery.component.html',
  styleUrls: ['./discovery.component.scss'],
})
export class DiscoveryComponent implements OnInit, OnDestroy {
  // NOTE: ngOnInit/ngOnDestroy permitted here per AGENTS.md 5.3 exception -
  // audio playback uses imperative HTMLAudioElement API requiring manual teardown.
  private readonly discoveryService = inject(DiscoveryService);
  private readonly userService = inject(UserService);
  private readonly seriousLearnerModeService = inject(SeriousLearnerModeService);
  private readonly i18n = inject(I18nService);
  private readonly safetyService = inject(SafetyService);
  private readonly offlineCache = inject(OfflineDiscoveryCacheService);
  private readonly discoveryOnboarding = inject(DiscoveryOnboardingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly matchmakingOnboarding = inject(MatchmakingOnboardingService);
  private readonly browserGeolocation = inject(BrowserGeolocationService);

  private currentAudio: HTMLAudioElement | null = null;
  readonly playingPartnerId = signal<string | null>(null);

  /** Whether currently offline and serving cached data */
  readonly isOffline = computed(() => !this.offlineCache.isOnline());
  readonly isUsingCachedData = computed(
    () => this.isOffline() && this.offlineCache.cachedDataAvailable(),
  );

  readonly partners = signal<
    (UserProfile & {
      nativeLangs?: { code: string; level: number }[];
      targetLangs?: { code: string; level: number }[];
      formattedDistance?: string;
      is_partner_of_week?: boolean;
      shared_interests?: string[];
    })[]
  >([]);
  readonly isLoading = signal<boolean>(true);
  readonly searchError = signal<string | null>(null);
  readonly hasError = computed(() => this.searchError() !== null);
  /** Why the last search failed, so an outage, a throttle and a bad filter read differently. */
  readonly searchFailure = signal<DiscoverySearchFailureKind | null>(null);
  readonly searchErrorDescriptionKey = computed(() => {
    switch (this.searchFailure()) {
      case 'unauthorised':
        return 'discovery.searchErrorUnauthorised';
      case 'rate_limited':
        return 'discovery.searchErrorRateLimited';
      case 'invalid_request':
        return 'discovery.searchErrorInvalid';
      default:
        return 'discovery.searchErrorDescription';
    }
  });
  /** Retrying an invalid filter set repeats the failure, so that state offers a reset instead. */
  readonly searchErrorActionKey = computed(() =>
    this.searchFailure() === 'invalid_request'
      ? 'discovery.noResultsAction'
      : 'discovery.searchErrorAction',
  );
  readonly myTargetLangs = signal<{ code: string; flag: string; labelKey: string }[]>([]);
  /** Target-language chips with a label that never falls back to a raw translation key. */
  readonly targetLanguageChips = computed(() => {
    this.i18n.translations();
    return this.myTargetLangs().map((lang) => ({ ...lang, label: this.languageLabel(lang.code) }));
  });
  readonly blockedUserIds = signal<string[]>([]);
  readonly primaryNativeLanguage = signal<string>('');
  readonly primaryTargetLanguage = signal<string>('');

  readonly selectedDistanceKm = signal<number>(50);
  readonly selectedNativeLanguage = signal<string>('');
  readonly selectedTargetLanguage = signal<string>('');
  readonly selectedProficiencyLevel = signal<string>('');
  readonly selectedGender = signal<string>('');
  readonly selectedInterests = signal<string>('');
  readonly seriousLearnerOnly = signal<boolean>(false);
  readonly seriousLearnerMode = this.seriousLearnerModeService.enabled;
  readonly seriousModeSaving = this.seriousLearnerModeService.saving;
  readonly seriousModeError = computed(() => this.seriousLearnerModeService.error() !== null);
  readonly seriousLearnerRelaxed = signal<boolean>(false);
  readonly availableTimeStart = signal<string>('');
  readonly availableTimeEnd = signal<string>('');
  private readonly authService = inject(AuthService);
  readonly isVip = computed(() => this.authService.currentUser()?.is_vip ?? false);

  readonly nearbyLocationStatus = signal<NearbyLocationStatus>('idle');
  private readonly nearbyCoordinates = signal<BrowserCoordinates | null>(null);
  readonly nearbyLocationReady = computed(
    () => this.selectedFilter() === 'nearby' && this.nearbyLocationStatus() === 'ready',
  );
  readonly nearbyLocationNeedsAction = computed(
    () =>
      this.selectedFilter() === 'nearby' &&
      this.nearbyLocationStatus() !== 'ready' &&
      this.nearbyLocationStatus() !== 'requesting',
  );

  readonly commonInterestTags: readonly string[] = [
    'sports',
    'music',
    'travel',
    'photography',
    'gaming',
    'cooking',
    'reading',
    'movies',
    'fitness',
    'art',
    'technology',
    'nature',
  ];
  readonly showAllInterests = signal(false);
  readonly visibleInterestTags = computed(() =>
    this.showAllInterests() ? this.commonInterestTags : this.commonInterestTags.slice(0, 6),
  );
  readonly errorBoundaryContext = computed(() => ({
    component: 'discovery',
    targetLanguage: this.selectedTargetLanguage(),
    partnerCount: this.partners().length,
    sortMode: this.selectedSort(),
    radiusKm: this.selectedDistanceKm(),
    nearbyLocationStatus: this.nearbyLocationStatus(),
  }));

  /** RxJS Subject for debounced search triggering, auto-cleans up via takeUntilDestroyed. */
  private readonly searchTrigger$ = new Subject<void>();
  /** Abort controller for cancelling in-flight partner search. */
  private searchAbortController: AbortController | null = null;

  private readonly discoveryTourEffect = effect(() => {
    // Start the onboarding tour once partners have loaded and tour not yet completed
    if (
      !this.isLoading() &&
      this.partners().length > 0 &&
      !this.discoveryOnboarding.hasCompletedTour()
    ) {
      queueMicrotask(() => this.discoveryOnboarding.startTour());
    }
  });

  readonly filterPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'all', label: this.i18n.translate('discovery.filterAll') },
      { id: 'serious', label: this.i18n.translate('discovery.filterSerious') },
      { id: 'nearby', label: this.i18n.translate('discovery.filterNearMe') },
      { id: 'city', label: this.i18n.translate('discovery.filterCity') },
      { id: 'paid', label: this.i18n.translate('discovery.filterPaidPractice') },
    ];
  });
  readonly selectedFilter = signal<string>('all');
  readonly showBanner = signal<boolean>(true);
  readonly ageRangeMin = signal<number>(18);
  readonly ageRangeMax = signal<number>(100);

  readonly voiceRoomActive = signal<boolean>(false);
  readonly hasAudioIntroOnly = signal<boolean>(false);
  readonly selectedSort = signal<string>('best_match');
  readonly sortOptions = computed(() => {
    this.i18n.translations();
    return [
      { id: 'best_match', label: this.i18n.translate('discovery.sortBestMatch') },
      { id: 'online_now', label: this.i18n.translate('discovery.sortOnlineNow') },
      { id: 'nearest', label: this.i18n.translate('discovery.sortNearest') },
      { id: 'newest', label: this.i18n.translate('discovery.sortNewest') },
    ];
  });

  setSort(sort: string): void {
    this.selectedSort.set(this.selectedFilter() === 'nearby' ? 'nearest' : sort);
    void this.searchPartners();
  }

  onAgeRangeChanged(range: AgeRange): void {
    this.ageRangeMin.set(range.min);
    this.ageRangeMax.set(range.max);
    this.scheduleSearch();
  }

  onDistanceChanged(km: number): void {
    if (this.selectedDistanceKm() === km) return;
    this.selectedDistanceKm.set(km);
    this.scheduleSearch();
  }

  onFilterSelect(id: string): void {
    this.selectedFilter.set(id);
    this.seriousLearnerOnly.set(id === 'serious' || this.seriousLearnerMode());
    if (id === 'nearby') {
      this.selectedDistanceKm.set(NEARBY_RADIUS_KM);
      this.selectedSort.set('nearest');
      void this.requestNearbyLocation();
      return;
    }

    // Precise browser coordinates are ephemeral and only retained while Nearby is active.
    this.nearbyCoordinates.set(null);
    this.nearbyLocationStatus.set('idle');
    if (id === 'city') {
      this.selectedDistanceKm.set(25); // 25km for city-level
    } else {
      this.selectedDistanceKm.set(50);
    }
    void this.searchPartners();
  }

  async requestNearbyLocation(): Promise<void> {
    if (this.selectedFilter() !== 'nearby') return;

    if (this.isOffline()) {
      this.nearbyCoordinates.set(null);
      this.nearbyLocationStatus.set('offline');
      this.partners.set([]);
      this.isLoading.set(false);
      return;
    }

    this.searchAbortController?.abort();
    this.searchAbortController = null;
    this.searchError.set(null);
    this.partners.set([]);
    this.nearbyLocationStatus.set('requesting');
    this.isLoading.set(false);

    try {
      const coordinates = await this.browserGeolocation.getCurrentPosition();
      // A late permission response must not reactivate Nearby after the user left it.
      if (this.selectedFilter() !== 'nearby') return;
      this.nearbyCoordinates.set(coordinates);
      this.nearbyLocationStatus.set('ready');
      await this.searchPartners();
    } catch (error) {
      if (this.selectedFilter() !== 'nearby') return;
      this.nearbyCoordinates.set(null);
      const code: NearbyLocationStatus =
        error instanceof BrowserGeolocationError ? error.code : 'position_unavailable';
      this.nearbyLocationStatus.set(code);
      this.partners.set([]);
      this.isLoading.set(false);
    }
  }

  setLanguage(code: string): void {
    this.selectedTargetLanguage.set(code);
    void this.searchPartners();
  }

  setGender(gender: string): void {
    this.selectedGender.set(gender);
    void this.searchPartners();
  }

  setInterest(interest: string): void {
    this.selectedInterests.set(this.selectedInterests() === interest ? '' : interest);
    void this.searchPartners();
  }

  useDefaultAvatar(event: Event): void {
    const image = event.target;
    if (
      image instanceof HTMLImageElement &&
      image.src !== new URL(DEFAULT_AVATAR_URL, image.baseURI).href
    ) {
      image.src = DEFAULT_AVATAR_URL;
    }
  }

  toggleShowAllInterests(): void {
    this.showAllInterests.update((value) => !value);
  }

  async ngOnInit(): Promise<void> {
    // Wire up RxJS-based debounced search auto-unsubscribed via takeUntilDestroyed
    this.searchTrigger$
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.searchPartners();
      });

    // Refresh the app-level preference before the first discovery request. This
    // avoids a flash of ordinary matching for users who saved Serious Learner mode.
    await this.seriousLearnerModeService.refresh();

    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        if (profile.target_languages) {
          const langs = profile.target_languages.map((code) => ({
            code,
            flag: getLanguageFlag(code),
            labelKey: `lang.${code.toLowerCase()}`,
          }));
          this.myTargetLangs.set(langs);
          this.primaryTargetLanguage.set(profile.target_languages[0] ?? '');
        }
        this.primaryNativeLanguage.set(profile.native_languages?.[0] ?? '');
      }
    } catch (e) {
      console.warn('Could not load user profile for target languages', e);
    }

    if (this.seriousLearnerMode()) {
      this.seriousLearnerOnly.set(true);
      this.selectedFilter.set('serious');
    }

    try {
      const blockedIds = await this.safetyService.getBlockedIdsAsync();
      this.blockedUserIds.set(blockedIds);
    } catch (e) {
      console.warn('Could not load blocked user IDs', e);
    }

    // Ordinary discovery never asks for browser location on application boot.
    await this.searchPartners();
  }

  async searchPartners(): Promise<void> {
    const isNearby = this.selectedFilter() === 'nearby';
    let coordinates: BrowserCoordinates | null = null;

    if (isNearby) {
      if (this.isOffline()) {
        this.nearbyLocationStatus.set('offline');
        this.partners.set([]);
        this.isLoading.set(false);
        return;
      }

      coordinates = this.nearbyCoordinates();
      if (!coordinates) {
        if (this.nearbyLocationStatus() === 'ready') {
          this.nearbyLocationStatus.set('idle');
        }
        this.partners.set([]);
        this.isLoading.set(false);
        return;
      }
      if (Date.now() - coordinates.capturedAt > NEARBY_COORDINATE_MAX_AGE_MS) {
        this.nearbyCoordinates.set(null);
        this.nearbyLocationStatus.set('stale');
        this.partners.set([]);
        this.isLoading.set(false);
        return;
      }
    }

    // Cancel any in-flight request to prevent stale responses and reduce server load
    if (this.searchAbortController) {
      this.searchAbortController.abort();
    }
    const controller = new AbortController();
    this.searchAbortController = controller;
    const signal = controller.signal;

    this.isLoading.set(true);
    this.searchError.set(null);
    this.searchFailure.set(null);
    try {
      const genderVal = this.selectedGender() || undefined;
      const isVip = this.authService.currentUser()?.is_vip ?? false;
      const seriousMode = this.seriousLearnerMode();
      const strictLanguageGoals = seriousMode && !this.seriousLearnerRelaxed();
      const strictCandidateNative = this.primaryTargetLanguage() || undefined;
      const strictCandidateTarget = this.primaryNativeLanguage() || undefined;
      const results = await this.discoveryService.findPartners(
        {
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
          radius_metres: this.selectedDistanceKm() * 1000,
          native_languages:
            strictLanguageGoals && strictCandidateNative
              ? strictCandidateNative
              : this.selectedNativeLanguage() || undefined,
          target_language:
            strictLanguageGoals && strictCandidateTarget
              ? strictCandidateTarget
              : this.selectedTargetLanguage() || undefined,
          serious_learner_only: seriousMode || this.seriousLearnerOnly(),
          gender: isVip ? genderVal : undefined,
          age_min: this.ageRangeMin(),
          age_max: this.ageRangeMax(),
          serious_learner_mode: seriousMode,
          proficiency_level: this.selectedProficiencyLevel() || undefined,
          available_time_start: this.availableTimeStart() || undefined,
          available_time_end: this.availableTimeEnd() || undefined,
          sort: isNearby ? 'nearest' : this.selectedSort(),
          voice_room_active: this.voiceRoomActive() || undefined,
          has_audio_intro: this.hasAudioIntroOnly() ? true : undefined,
          interests: this.selectedInterests() || undefined,
        },
        signal,
      );
      // If request was aborted, don't update the UI with stale results
      if (signal.aborted) return;

      // Filter out blocked users. Nearby additionally rejects non-spatial fallback rows:
      // a location search must never silently become an unrelated global search.
      const blocked = this.blockedUserIds();
      const filtered = results.filter(
        (user) =>
          (blocked.length === 0 || !blocked.includes(user.id)) &&
          (!isNearby ||
            (typeof user.distance_metres === 'number' && Number.isFinite(user.distance_metres))),
      );

      const mapped = filtered.map((partner) => ({
        ...partner,
        nativeLangs: (partner.native_languages ?? []).map((code) => ({ code, level: 5 })),
        targetLangs: (partner.target_languages ?? []).map((code) => ({ code, level: 1 })),
        formattedDistance: this.formatDistanceHelper(partner.distance_metres),
      }));

      this.partners.set(mapped);
    } catch (error) {
      // Do not report failures from an intentionally superseded request.
      if (!signal.aborted) {
        const searchError =
          error instanceof DiscoverySearchError ? error : new DiscoverySearchError('unavailable');
        console.error('Partner search failed', {
          kind: searchError.kind,
          status: searchError.status,
        });
        this.partners.set([]);
        this.searchFailure.set(searchError.kind);
        this.searchError.set(this.i18n.translate('discovery.searchError'));
      }
    } finally {
      // An older aborted request must not clear the loading state owned by its replacement.
      if (this.searchAbortController === controller) {
        this.searchAbortController = null;
        this.isLoading.set(false);
      }
    }
  }

  /** Debounced search via RxJS Subject - no manual timer, auto-cleans up. */
  private scheduleSearch(): void {
    this.searchTrigger$.next();
  }

  retrySearch(): void {
    if (this.selectedFilter() === 'nearby' && !this.nearbyLocationReady()) {
      void this.requestNearbyLocation();
      return;
    }
    void this.searchPartners();
  }

  resolveSearchError(): void {
    if (this.searchFailure() === 'invalid_request') {
      this.resetFilters();
      return;
    }
    this.retrySearch();
  }

  toggleVoiceRoomActive(): void {
    this.voiceRoomActive.update((v) => !v);
    void this.searchPartners();
  }

  async toggleSeriousLearnerMode(): Promise<void> {
    if (this.seriousModeSaving()) return;

    const next = !this.seriousLearnerMode();
    const saved = await this.seriousLearnerModeService.setEnabled(next);
    if (!saved) return;

    this.seriousLearnerRelaxed.set(false);
    if (this.seriousLearnerMode()) {
      this.seriousLearnerOnly.set(true);
      this.selectedFilter.set('serious');
    } else if (this.selectedFilter() === 'serious') {
      this.seriousLearnerOnly.set(false);
      this.selectedFilter.set('all');
    }
    await this.searchPartners();
  }

  showBroaderSeriousLearnerMatches(): void {
    if (!this.seriousLearnerMode()) return;
    this.seriousLearnerRelaxed.set(true);
    void this.searchPartners();
  }

  private formatDistanceHelper(metres: number | undefined): string {
    if (metres == null || !Number.isFinite(metres) || metres < 0) return '';

    const locale = this.i18n.currentLang();
    const useMiles = locale.toLowerCase() === 'en-gb' || locale.toLowerCase() === 'en-us';

    if (useMiles) {
      const miles = metres / 1609.344;
      if (miles < 1) {
        const roundedFeet = Math.max(500, Math.round((metres * 3.28084) / 500) * 500);
        return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(roundedFeet)} ft`;
      }
      const roundedMiles = Math.max(0.5, Math.round(miles * 2) / 2);
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(roundedMiles)} mi`;
    }

    if (metres < 1000) {
      const roundedMetres = Math.max(100, Math.round(metres / 100) * 100);
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(roundedMetres)} m`;
    }
    const roundedKm = Math.max(0.5, Math.round((metres / 1000) * 2) / 2);
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(roundedKm)} km`;
  }

  private languageLabel(code: string): string {
    const normalisedCode = code.toLowerCase();
    const key = `lang.${normalisedCode}`;
    const translated = this.i18n.translate(key);
    if (translated !== key) return translated;

    try {
      return (
        new Intl.DisplayNames([this.i18n.currentLang()], { type: 'language' }).of(normalisedCode) ??
        code.toUpperCase()
      );
    } catch {
      return code.toUpperCase();
    }
  }

  toggleAudioIntro(partnerId: string, audioIntroUrl: string | undefined, event: Event): void {
    event.stopPropagation();
    if (!audioIntroUrl) return;

    if (this.playingPartnerId() === partnerId) {
      this.stopAudioIntro();
      return;
    }

    this.stopAudioIntro();

    const audio = new Audio(audioIntroUrl);
    const onEnded = () => this.stopAudioIntro();
    const onError = () => this.stopAudioIntro();
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);
    this.currentAudio = audio;
    this.playingPartnerId.set(partnerId);

    void audio.play().catch(() => this.stopAudioIntro());
  }

  private stopAudioIntro(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      // Remove event listeners to prevent memory leaks
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      // Force load a short empty source to release the audio resource
      this.currentAudio.src = '';
      this.currentAudio.load();
      this.currentAudio = null;
    }
    this.playingPartnerId.set(null);
  }

  getActiveStatus(lastActiveAt: string): string {
    if (!lastActiveAt) return '';
    const last = new Date(lastActiveAt).getTime();
    const now = Date.now();
    const diffSec = Math.floor((now - last) / 1000);
    if (diffSec < 60) return this.i18n.translate('discovery.activeNow');
    if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return this.i18n.translate('discovery.activeMinutesAgo', { minutes: mins });
    }
    if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return this.i18n.translate('discovery.activeHoursAgo', { hours });
    }
    const days = Math.floor(diffSec / 86400);
    if (days === 1) return this.i18n.translate('discovery.activeYesterday');
    return this.i18n.translate('discovery.activeDaysAgo', { days });
  }

  ngOnDestroy(): void {
    // Cancel any in-flight search
    if (this.searchAbortController) {
      this.searchAbortController.abort();
      this.searchAbortController = null;
    }
    this.nearbyCoordinates.set(null);
    this.nearbyLocationStatus.set('idle');
    // Debounce subscription auto-unsubscribed via takeUntilDestroyed
    this.searchTrigger$.complete();
    this.stopAudioIntro();
  }

  onGlobalSearch(filters: {
    native_languages?: string;
    target_language?: string;
    proficiency_level?: string;
    has_audio_intro?: boolean;
  }): void {
    if (filters.native_languages !== undefined) {
      this.selectedNativeLanguage.set(filters.native_languages);
    }
    if (filters.target_language !== undefined) {
      this.selectedTargetLanguage.set(filters.target_language);
    }
    if (filters.proficiency_level !== undefined) {
      this.selectedProficiencyLevel.set(filters.proficiency_level);
    }
    if (filters.has_audio_intro !== undefined) {
      this.hasAudioIntroOnly.set(filters.has_audio_intro);
    }
    void this.searchPartners();
  }

  resetFilters(): void {
    this.selectedDistanceKm.set(50);
    this.selectedNativeLanguage.set('');
    this.selectedTargetLanguage.set('');
    this.selectedProficiencyLevel.set('');
    this.selectedGender.set('');
    this.seriousLearnerOnly.set(this.seriousLearnerMode());
    this.selectedFilter.set(this.seriousLearnerMode() ? 'serious' : 'all');
    this.seriousLearnerRelaxed.set(false);
    this.ageRangeMin.set(18);
    this.ageRangeMax.set(100);
    this.availableTimeStart.set('');
    this.availableTimeEnd.set('');
    this.selectedSort.set('best_match');
    this.voiceRoomActive.set(false);
    this.hasAudioIntroOnly.set(false);
    this.selectedInterests.set('');
    this.showAllInterests.set(false);
    this.nearbyCoordinates.set(null);
    this.nearbyLocationStatus.set('idle');
    void this.searchPartners();
  }

  /** Start the matchmaking algorithm onboarding tour. */
  startMatchmakingTour(): void {
    this.matchmakingOnboarding.startTour();
  }

  /** Whether the matchmaking onboarding tour is currently active. */
  isMatchmakingTourActive(): boolean {
    return this.matchmakingOnboarding.isTourInProgress();
  }

  /** Close the matchmaking onboarding tour and mark it complete. */
  closeMatchmakingTour(): void {
    this.matchmakingOnboarding.markComplete();
  }
}
