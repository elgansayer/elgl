import { Component, inject, signal, computed, OnInit } from '@angular/core';

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
import { RouterLink } from '@angular/router';
import { AgeRangeSliderComponent, AgeRange } from '../age-range-slider/age-range-slider.component';

@Component({
  selector: 'app-discovery',
  imports: [
    FormsModule,
    TranslatePipe,
    ScrollablePillsComponent,
    FluencyIndicatorComponent,
    AppGradientButtonComponent,
    LanguagePickerComponent,
    RouterLink,
    AgeRangeSliderComponent,
  ],
  templateUrl: './discovery.component.html',
  styleUrls: ['./discovery.component.scss'],
})
export class DiscoveryComponent implements OnInit {
  private readonly discoveryService = inject(DiscoveryService);
  private readonly userService = inject(UserService);
  private readonly i18n = inject(I18nService);
  private readonly safetyService = inject(SafetyService);

  readonly partners = signal<UserProfile[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly myTargetLangs = signal<{ code: string; flag: string; labelKey: string }[]>([]);
  readonly blockedUserIds = signal<string[]>([]);

  readonly distanceBandsKm = [10, 25, 50, 100, 250] as const;
  readonly selectedDistanceKm = signal<number>(50);
  readonly selectedNativeLanguage = signal<string>('');
  readonly selectedTargetLanguage = signal<string>('');
  readonly selectedGender = signal<string>('');
  readonly seriousLearnerOnly = signal<boolean>(false);
  private readonly authService = inject(AuthService);
  readonly isVip = computed(() => this.authService.currentUser()?.is_vip ?? false);

  readonly filterPills = computed(() => {
    this.i18n.translations();
    return [
      { id: 'all', label: this.i18n.translate('discovery.filterAll') },
      { id: 'serious', label: this.i18n.translate('discovery.filterSerious') },
      { id: 'nearby', label: this.i18n.translate('discovery.filterNearMe') },
    ];
  });
  readonly selectedFilter = signal<string>('all');
  readonly showBanner = signal<boolean>(true);
  readonly ageRangeMin = signal<number>(18);
  readonly ageRangeMax = signal<number>(100);

  onAgeRangeChanged(range: AgeRange): void {
    this.ageRangeMin.set(range.min);
    this.ageRangeMax.set(range.max);
    void this.searchPartners();
  }

  onFilterSelect(id: string) {
    this.selectedFilter.set(id);
    this.seriousLearnerOnly.set(id === 'serious');
    this.selectedDistanceKm.set(id === 'nearby' ? 10 : 50); // 10km for nearby, 50km default
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

  getNativeLangs(partner: UserProfile) {
    return (partner.native_languages || ['EN']).map((code) => ({ code, level: 5 }));
  }

  getTargetLangs(partner: UserProfile) {
    return (partner.target_languages?.length ? partner.target_languages : ['JA']).map((code) => ({
      code,
      level: 1,
    }));
  }

  async ngOnInit(): Promise<void> {
    try {
      const profile = await this.userService.getMyProfile();
      if (profile && profile.target_languages) {
        const langs = profile.target_languages.map((code) => ({
          code,
          flag: getLanguageFlag(code),
          labelKey: `lang.${code.toLowerCase()}`,
        }));
        this.myTargetLangs.set(langs);
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
      });
      // Filter out blocked users
      const blocked = this.blockedUserIds();
      const filtered =
        blocked.length > 0 ? results.filter((u) => !blocked.includes(u.id)) : results;
      this.partners.set(filtered);
    } catch (e) {
      console.error('Partner search failed:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  formatDistance(metres: number | undefined): string {
    if (metres == null) return '';
    const km = metres / 1000;
    const miles = metres / 1609.344;
    if (km < 1) {
      return `${metres.toFixed(0)} m (${miles.toFixed(2)} mi)`;
    }
    return `${km.toFixed(1)} km · ${miles.toFixed(1)} mi`;
  }

  resetFilters(): void {
    this.selectedDistanceKm.set(50);
    this.selectedNativeLanguage.set('');
    this.selectedTargetLanguage.set('');
    this.seriousLearnerOnly.set(false);
    this.ageRangeMin.set(18);
    this.ageRangeMax.set(100);
    void this.searchPartners();
  }
}
