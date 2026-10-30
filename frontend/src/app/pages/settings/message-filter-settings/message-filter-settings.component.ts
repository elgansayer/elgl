import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { MessageFilterService, MessageFilters } from '../../../services/message-filter.service';

interface LanguageOption {
  code: string;
  labelKey: string;
}

const COMMON_LANGUAGES: LanguageOption[] = [
  { code: 'ar', labelKey: 'languageName.ar' },
  { code: 'bn', labelKey: 'languageName.bn' },
  { code: 'zh', labelKey: 'languageName.zh' },
  { code: 'cs', labelKey: 'languageName.cs' },
  { code: 'nl', labelKey: 'languageName.nl' },
  { code: 'en', labelKey: 'languageName.en' },
  { code: 'fr', labelKey: 'languageName.fr' },
  { code: 'de', labelKey: 'languageName.de' },
  { code: 'el', labelKey: 'languageName.el' },
  { code: 'he', labelKey: 'languageName.he' },
  { code: 'hi', labelKey: 'languageName.hi' },
  { code: 'id', labelKey: 'languageName.id' },
  { code: 'it', labelKey: 'languageName.it' },
  { code: 'ja', labelKey: 'languageName.ja' },
  { code: 'ko', labelKey: 'languageName.ko' },
  { code: 'ms', labelKey: 'languageName.ms' },
  { code: 'fa', labelKey: 'languageName.fa' },
  { code: 'pl', labelKey: 'languageName.pl' },
  { code: 'pt', labelKey: 'languageName.pt' },
  { code: 'ru', labelKey: 'languageName.ru' },
  { code: 'es', labelKey: 'languageName.es' },
  { code: 'sv', labelKey: 'languageName.sv' },
  { code: 'th', labelKey: 'languageName.th' },
  { code: 'tr', labelKey: 'languageName.tr' },
  { code: 'uk', labelKey: 'languageName.uk' },
  { code: 'ur', labelKey: 'languageName.ur' },
  { code: 'vi', labelKey: 'languageName.vi' },
];

const GENDER_OPTIONS: LanguageOption[] = [
  { code: 'male', labelKey: 'profile.gender.male' },
  { code: 'female', labelKey: 'profile.gender.female' },
  { code: 'other', labelKey: 'profile.gender.other' },
];

const MINIMUM_FILTER_AGE = 0;
const MAXIMUM_FILTER_AGE = 120;

@Component({
  standalone: true,
  selector: 'app-message-filter-settings',
  templateUrl: './message-filter-settings.component.html',
  imports: [HlmInput, HlmButton, TranslatePipe, FormsModule],
})
export class MessageFilterSettingsComponent implements OnInit {
  private readonly messageFilterService = inject(MessageFilterService);
  private readonly location = inject(Location);

  readonly isLoading = signal(true);
  readonly loadFailed = signal(false);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly ageMin = signal<number | null>(null);
  readonly ageMax = signal<number | null>(null);
  readonly selectedLanguages = signal<string[]>([]);
  readonly selectedGenders = signal<string[]>([]);
  // Settings this page does not edit yet are round-tripped so saving never resets them.
  private readonly matchPreferences = signal<
    Pick<
      MessageFilters,
      'same_native_language' | 'same_target_language' | 'same_gender' | 'same_age'
    >
  >({});

  readonly languages = COMMON_LANGUAGES;
  readonly genderOptions = GENDER_OPTIONS;
  readonly minimumFilterAge = MINIMUM_FILTER_AGE;
  readonly maximumFilterAge = MAXIMUM_FILTER_AGE;

  readonly hasFilters = computed(() => {
    return (
      this.ageMin() !== null ||
      this.ageMax() !== null ||
      this.selectedLanguages().length > 0 ||
      this.selectedGenders().length > 0
    );
  });

  async ngOnInit(): Promise<void> {
    await this.loadFilters();
  }

  async loadFilters(): Promise<void> {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.errorMessage.set('');

    try {
      const filters = await this.messageFilterService.load();
      this.ageMin.set(filters.age_min ?? null);
      this.ageMax.set(filters.age_max ?? null);
      this.selectedLanguages.set(filters.allowed_native_languages ?? []);
      this.selectedGenders.set(filters.allowed_genders ?? []);
      this.matchPreferences.set({
        same_native_language: filters.same_native_language,
        same_target_language: filters.same_target_language,
        same_gender: filters.same_gender,
        same_age: filters.same_age,
      });
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  toggleLanguage(code: string): void {
    this.selectedLanguages.update((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }

  toggleGender(code: string): void {
    this.selectedGenders.update((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }

  async saveFilters(): Promise<void> {
    if (this.loadFailed() || this.isSaving()) return;

    this.errorMessage.set('');
    this.successMessage.set('');

    const minimumAge = this.ageMin();
    const maximumAge = this.ageMax();
    if (
      (minimumAge !== null &&
        (minimumAge < MINIMUM_FILTER_AGE || minimumAge > MAXIMUM_FILTER_AGE)) ||
      (maximumAge !== null && (maximumAge < MINIMUM_FILTER_AGE || maximumAge > MAXIMUM_FILTER_AGE))
    ) {
      this.errorMessage.set('settings.messageFilters.invalidAge');
      return;
    }

    if (minimumAge !== null && maximumAge !== null && minimumAge > maximumAge) {
      this.errorMessage.set('settings.messageFilters.invalidAgeRange');
      return;
    }

    this.isSaving.set(true);

    try {
      const match = this.matchPreferences();
      await this.messageFilterService.save({
        enabled: true,
        allow_everyone: false,
        age_min: this.ageMin() ?? undefined,
        age_max: this.ageMax() ?? undefined,
        allowed_native_languages:
          this.selectedLanguages().length > 0 ? this.selectedLanguages() : undefined,
        // An empty list clears a previously saved gender restriction.
        allowed_genders: this.selectedGenders(),
        same_native_language: match.same_native_language ?? false,
        same_target_language: match.same_target_language ?? false,
        same_gender: match.same_gender ?? false,
        same_age: match.same_age ?? false,
      });
      this.successMessage.set('settings.messageFilters.saved');
    } catch {
      this.errorMessage.set('settings.messageFilters.saveError');
    } finally {
      this.isSaving.set(false);
    }
  }

  getLanguageLabelKey(code: string): string {
    return this.languages.find((language) => language.code === code)?.labelKey ?? code;
  }

  goBack(): void {
    this.location.back();
  }
}
