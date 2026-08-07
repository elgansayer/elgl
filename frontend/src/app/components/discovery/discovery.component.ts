import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { DiscoveryService } from '../../services/discovery.service';
import { UserProfile, UserService } from '../../services/user.service';
import { SafetyService } from '../../services/safety.service';
import { AuthService } from '../../services/auth.service';

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

@Component({
  selector: 'app-discovery',
  imports: [
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
  ],
  templateUrl: './discovery.component.html',
  styleUrls: ['./discovery.component.scss'],
})
export class DiscoveryComponent implements OnInit, OnDestroy {
  private readonly discoveryService = inject(DiscoveryService);
  private readonly userService = inject(UserService);
  private readonly i18n = inject(I18nService);
  private readonly safetyService = inject(SafetyService);

  private currentAudio: HTMLAudioElement | null = null;
  readonly playingPartnerId = signal<string | null>(null);

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
  readonly myTargetLangs = signal<{ code: string; flag: string; labelKey: string }[]>([]);
  readonly blockedUserIds = signal<string[]>([]);

  readonly distanceBandsKm: readonly number[] = [10, 25, 50, 100, 250];
  readonly selectedDistanceKm = signal<number>(50);
  readonly selectedNativeLanguage = signal<string>('');
  readonly selectedTargetLanguage = signal<string>('');
  readonly selectedProficiencyLevel = signal<string>('');
  readonly selectedGender = signal<string>('');
  readonly seriousLearnerOnly = signal<boolean>(false);
  readonly seriousLearnerMode = signal<boolean>(false);
  readonly availableTimeStart = signal<string>('');
  readonly availableTimeEnd = signal<string>('');
  private readonly authService = inject(AuthService);
  readonly isVip = computed(() => this.authService.currentUser()?.is_vip ?? false);

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
    this.selectedSort.set(sort);
    void this.searchPartners();
  }

  onAgeRangeChanged(range: AgeRange): void {
    this.ageRangeMin.set(range.min);
    this.ageRangeMax.set(range.max);
    void this.searchPartners();
  }

  onDistanceChanged(km: number): void {
    if (this.selectedDistanceKm() === km) return;
    this.selectedDistanceKm.set(km);
    void this.searchPartners();
  }

  onFilterSelect(id: string) {
    this.selectedFilter.set(id);
    this.seriousLearnerOnly.set(id === 'serious');
    if (id === 'nearby') {
      this.selectedDistanceKm.set(10); // 10km for nearby
    } else if (id === 'city') {
      this.selectedDistanceKm.set(25); // 25km for city-level
    } else {
      this.selectedDistanceKm.set(50);
    }
    void this.searchPartners();
  }

  setLanguage(code: string) {
    this.selectedTargetLanguage.set(code);
    void this.searchPartners();
  }

  setGender(gender: string) {
    this.selectedGender.set(gender);
    void this.searchPartners();
  }

  async ngOnInit(): Promise<void> {
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
        }
        // Restore serious learner mode
        if (profile.is_serious_learner != null) {
          this.seriousLearnerMode.set(profile.is_serious_learner);
          if (profile.is_serious_learner) {
            this.seriousLearnerOnly.set(true);
            this.selectedFilter.set('serious');
          }
        }
      }
    } catch (e) {
      console.warn('Could not load user profile for target languages', e);
    }

    try {
      const blockedIds = await this.safetyService.getBlockedIdsAsync();
      this.blockedUserIds.set(blockedIds);
    } catch (e) {
      console.warn('Could not load blocked user IDs', e);
    }

    await this.searchPartners();
  }

  async searchPartners(): Promise<void> {
    this.isLoading.set(true);
    try {
      const genderVal = this.selectedGender() || undefined;
      const isVip = this.authService.currentUser()?.is_vip ?? false;
      const results = await this.discoveryService.findPartners({
        radius_metres: this.selectedDistanceKm() * 1000,
        native_languages: this.selectedNativeLanguage() || undefined,
        target_language: this.selectedTargetLanguage() || undefined,
        serious_learner_only: this.seriousLearnerOnly(),
        gender: isVip ? genderVal : undefined,
        age_min: this.ageRangeMin(),
        age_max: this.ageRangeMax(),
        serious_learner_mode: this.seriousLearnerMode(),
        proficiency_level: this.selectedProficiencyLevel() || undefined,
        available_time_start:
          this.availableTimeStart() || undefined,
        available_time_end:
          this.availableTimeEnd() || undefined,
        sort: this.selectedSort(),
        voice_room_active: this.voiceRoomActive() || undefined,
      });
      // Filter out blocked users
      const blocked = this.blockedUserIds();
      const filtered =
        blocked.length > 0 ? results.filter((u) => !blocked.includes(u.id)) : results;

      const mapped = filtered.map((partner) => ({
        ...partner,
        nativeLangs: (partner.native_languages || ['EN']).map((code) => ({ code, level: 5 })),
        targetLangs: (partner.target_languages?.length ? partner.target_languages : ['JA']).map((code) => ({
          code,
          level: 1,
        })),
        formattedDistance: this.formatDistanceHelper(partner.distance_metres),
      }));

      this.partners.set(mapped);
    } catch (e) {
      console.error('Partner search failed:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleVoiceRoomActive(): void {
    this.voiceRoomActive.update((v) => !v);
    void this.searchPartners();
  }

  async toggleSeriousLearnerMode(): Promise<void> {
    const newMode = !this.seriousLearnerMode();
    try {
      await this.userService.updateMyProfile({ is_serious_learner: newMode });
      this.seriousLearnerMode.set(newMode);
      if (newMode) {
        this.seriousLearnerOnly.set(true);
        this.selectedFilter.set('serious');
      }
      await this.searchPartners();
    } catch (e) {
      console.error('Failed to update serious learner mode', e);
    }
  }

  private formatDistanceHelper(metres: number | undefined): string {
    if (metres == null) return '';
    const km = metres / 1000;
    const miles = metres / 1609.344;
    if (km < 1) {
      return `${metres.toFixed(0)} m (${miles.toFixed(2)} mi)`;
    }
    return `${km.toFixed(1)} km · ${miles.toFixed(1)} mi`;
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
    audio.addEventListener('ended', () => this.stopAudioIntro());
    audio.addEventListener('error', () => this.stopAudioIntro());
    this.currentAudio = audio;
    this.playingPartnerId.set(partnerId);

    void audio.play().catch(() => this.stopAudioIntro());
  }

  private stopAudioIntro(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
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
    this.stopAudioIntro();
  }

  onGlobalSearch(filters: {
    native_languages?: string;
    target_language?: string;
    proficiency_level?: string;
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
    void this.searchPartners();
  }

  resetFilters(): void {
    this.selectedDistanceKm.set(50);
    this.selectedNativeLanguage.set('');
    this.selectedTargetLanguage.set('');
    this.selectedProficiencyLevel.set('');
    this.selectedGender.set('');
    this.seriousLearnerOnly.set(false);
    this.seriousLearnerMode.set(false);
    this.ageRangeMin.set(18);
    this.ageRangeMax.set(100);
    this.availableTimeStart.set('');
    this.availableTimeEnd.set('');
    this.selectedSort.set('best_match');
    this.voiceRoomActive.set(false);
    void this.searchPartners();
  }
}
