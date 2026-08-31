import { Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmInput } from '@spartan-ng/helm/input';
import { MessageFilterService } from '../../../services/message-filter.service';
import { TranslatePipe } from '../../../services/translate.pipe';

const GENDER_OPTIONS = [
  { code: 'male', name: 'profile.gender.male' },
  { code: 'female', name: 'profile.gender.female' },
  { code: 'other', name: 'profile.gender.other' },
];

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
];

@Component({
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
  readonly sameNativeLanguage = signal(false);
  readonly sameTargetLanguage = signal(false);
  readonly sameGender = signal(false);
  readonly sameAge = signal(false);
  readonly genderOptions = GENDER_OPTIONS;
  readonly languageOptions = LANGUAGE_OPTIONS;

  readonly hasFilters = computed(
    () =>
      this.ageMin() !== null ||
      this.ageMax() !== null ||
      this.selectedLanguages().length > 0 ||
      this.selectedGenders().length > 0 ||
      this.sameNativeLanguage() ||
      this.sameTargetLanguage() ||
      this.sameGender() ||
      this.sameAge(),
  );

  async ngOnInit(): Promise<void> {
    await this.loadFilters();
  }

  async loadFilters(): Promise<void> {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.errorMessage.set('');
    try {
      const filters = await this.messageFilterService.load();
      const enabled = filters.enabled ?? this.hasLegacyRestrictions(filters);
      const allowEveryone = filters.allow_everyone ?? !enabled;
      this.ageMin.set(enabled && !allowEveryone ? (filters.age_min ?? null) : null);
      this.ageMax.set(enabled && !allowEveryone ? (filters.age_max ?? null) : null);
      this.selectedLanguages.set(
        enabled && !allowEveryone ? (filters.allowed_native_languages ?? []) : [],
      );
      this.selectedGenders.set(enabled && !allowEveryone ? (filters.allowed_genders ?? []) : []);
      this.sameNativeLanguage.set(
        enabled && !allowEveryone && Boolean(filters.same_native_language),
      );
      this.sameTargetLanguage.set(
        enabled && !allowEveryone && Boolean(filters.same_target_language),
      );
      this.sameGender.set(enabled && !allowEveryone && Boolean(filters.same_gender));
      this.sameAge.set(enabled && !allowEveryone && Boolean(filters.same_age));
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  selectEveryone(): void {
    this.ageMin.set(null);
    this.ageMax.set(null);
    this.selectedLanguages.set([]);
    this.selectedGenders.set([]);
    this.sameNativeLanguage.set(false);
    this.sameTargetLanguage.set(false);
    this.sameGender.set(false);
    this.sameAge.set(false);
  }

  toggleGender(code: string): void {
    this.selectedGenders.update((values) =>
      values.includes(code) ? values.filter((value) => value !== code) : [...values, code],
    );
  }

  toggleLanguage(code: string): void {
    this.selectedLanguages.update((values) =>
      values.includes(code) ? values.filter((value) => value !== code) : [...values, code],
    );
  }

  async saveFilters(): Promise<void> {
    if (this.loadFailed() || this.isSaving()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.ageMin() !== null && this.ageMax() !== null && this.ageMin()! > this.ageMax()!) {
      this.errorMessage.set('settings.messageFilters.invalidAgeRange');
      return;
    }

    this.isSaving.set(true);
    try {
      const enabled = this.hasFilters();
      await this.messageFilterService.save({
        enabled,
        allow_everyone: !enabled,
        age_min: this.ageMin() ?? undefined,
        age_max: this.ageMax() ?? undefined,
        allowed_native_languages: this.selectedLanguages(),
        allowed_genders: this.selectedGenders(),
        same_native_language: this.sameNativeLanguage(),
        same_target_language: this.sameTargetLanguage(),
        same_gender: this.sameGender(),
        same_age: this.sameAge(),
      });
      this.successMessage.set('settings.messageFilters.saved');
    } catch {
      this.errorMessage.set('settings.messageFilters.saveError');
    } finally {
      this.isSaving.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }

  private hasLegacyRestrictions(filters: {
    age_min?: number;
    age_max?: number;
    allowed_native_languages?: string[];
    allowed_genders?: string[];
  }): boolean {
    return Boolean(
      filters.age_min !== undefined ||
      filters.age_max !== undefined ||
      filters.allowed_native_languages?.length ||
      filters.allowed_genders?.length,
    );
  }
}
