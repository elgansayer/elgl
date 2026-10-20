import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../services/user.service';

interface LanguageOption {
  code: string;
  name: string;
}

const COMMON_LANGUAGES: LanguageOption[] = [
  { code: 'ar', name: 'Arabic' },
  { code: 'bn', name: 'Bengali' },
  { code: 'zh', name: 'Chinese' },
  { code: 'cs', name: 'Czech' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ms', name: 'Malay' },
  { code: 'fa', name: 'Persian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'es', name: 'Spanish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'vi', name: 'Vietnamese' },
];

const GENDER_OPTIONS: LanguageOption[] = [
  { code: 'male', name: 'profile.gender.male' },
  { code: 'female', name: 'profile.gender.female' },
  { code: 'other', name: 'profile.gender.other' },
];

@Component({
  standalone: true,
  selector: 'app-message-filter-settings',
  templateUrl: './message-filter-settings.component.html',
  imports: [HlmInput, HlmButton, TranslatePipe, FormsModule],
})
export class MessageFilterSettingsComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly location = inject(Location);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly ageMin = signal<number | null>(null);
  readonly ageMax = signal<number | null>(null);
  readonly selectedLanguages = signal<string[]>([]);
  readonly selectedGenders = signal<string[]>([]);

  readonly languages = COMMON_LANGUAGES;
  readonly genderOptions = GENDER_OPTIONS;

  readonly hasFilters = computed(() => {
    return (
      this.ageMin() !== null ||
      this.ageMax() !== null ||
      this.selectedLanguages().length > 0 ||
      this.selectedGenders().length > 0
    );
  });

  async ngOnInit(): Promise<void> {
    try {
      const filters = await this.userService.getMessageFilters();
      if (filters) {
        if (filters.age_min !== undefined) this.ageMin.set(filters.age_min);
        if (filters.age_max !== undefined) this.ageMax.set(filters.age_max);
        if (filters.allowed_native_languages) {
          this.selectedLanguages.set(filters.allowed_native_languages);
        }
        if (filters.allowed_genders) {
          this.selectedGenders.set(filters.allowed_genders);
        }
      }
    } catch {
      // Keep defaults
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
    this.errorMessage.set('');
    this.successMessage.set('');
    this.isSaving.set(true);

    try {
      await this.userService.setMessageFilters({
        age_min: this.ageMin() ?? undefined,
        age_max: this.ageMax() ?? undefined,
        allowed_native_languages:
          this.selectedLanguages().length > 0 ? this.selectedLanguages() : undefined,
        allowed_genders: this.selectedGenders().length > 0 ? this.selectedGenders() : undefined,
      });
      this.successMessage.set('settings.messageFilters.saved');
    } catch {
      this.errorMessage.set('settings.messageFilters.saveError');
    } finally {
      this.isSaving.set(false);
    }
  }

  getLanguageName(code: string): string {
    return this.languages.find((l) => l.code === code)?.name ?? code.toUpperCase();
  }

  goBack(): void {
    this.location.back();
  }
}
