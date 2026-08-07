import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../services/translate.pipe';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-message-filter-settings',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './message-filter-settings.component.html',
})
export class MessageFilterSettingsComponent implements OnInit {
  private userService = inject(UserService);

  readonly ageMin = signal<number | null>(null);
  readonly ageMax = signal<number | null>(null);
  readonly allowedGenders = signal<string[]>([]);
  readonly allowedNativeLanguages = signal<string[]>([]);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);

  readonly genderOptions = [
    { value: 'male', key: 'settings.messageFilter.genderMale' },
    { value: 'female', key: 'settings.messageFilter.genderFemale' },
    { value: 'other', key: 'settings.messageFilter.genderOther' },
  ];

  readonly commonLanguages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'it', name: 'Italiano' },
    { code: 'pt', name: 'Português' },
    { code: 'ru', name: 'Русский' },
    { code: 'zh', name: '中文' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'ar', name: 'العربية' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'tr', name: 'Türkçe' },
    { code: 'th', name: 'ไทย' },
    { code: 'vi', name: 'Tiếng Việt' },
  ];

  async ngOnInit(): Promise<void> {
    try {
      const filters = await this.userService.getMessageFilters();
      if (filters.age_min != null) this.ageMin.set(filters.age_min);
      if (filters.age_max != null) this.ageMax.set(filters.age_max);
      if (filters.allowed_genders) this.allowedGenders.set([...filters.allowed_genders]);
      if (filters.allowed_native_languages)
        this.allowedNativeLanguages.set([...filters.allowed_native_languages]);
    } catch {
      // Use defaults
    }
    this.loaded.set(true);
  }

  protected toggleGender(gender: string): void {
    const current = this.allowedGenders();
    if (current.includes(gender)) {
      this.allowedGenders.set(current.filter((g) => g !== gender));
    } else {
      this.allowedGenders.set([...current, gender]);
    }
  }

  protected toggleNativeLanguage(code: string): void {
    const current = this.allowedNativeLanguages();
    if (current.includes(code)) {
      this.allowedNativeLanguages.set(current.filter((l) => l !== code));
    } else {
      this.allowedNativeLanguages.set([...current, code]);
    }
  }

  protected async saveFilters(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);

    try {
      await this.userService.setMessageFilters({
        age_min: this.ageMin() ?? undefined,
        age_max: this.ageMax() ?? undefined,
        allowed_genders: this.allowedGenders().length > 0 ? this.allowedGenders() : undefined,
        allowed_native_languages:
          this.allowedNativeLanguages().length > 0 ? this.allowedNativeLanguages() : undefined,
      });
      this.saved.set(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save filters';
      this.error.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  protected clearAgeFilters(): void {
    this.ageMin.set(null);
    this.ageMax.set(null);
  }

  protected clearAllFilters(): void {
    this.ageMin.set(null);
    this.ageMax.set(null);
    this.allowedGenders.set([]);
    this.allowedNativeLanguages.set([]);
  }

  protected coerceNumber(value: unknown): number | null {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
}
