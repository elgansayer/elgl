import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { TranslatePipe } from '../../../services/translate.pipe';
import { FormsModule } from '@angular/forms';
import { MessageFilterSettingsService } from './message-filter-settings.service';

interface GenderOption {
  code: string;
  name: string;
}

const GENDER_OPTIONS: GenderOption[] = [
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
  private readonly filtersService = inject(MessageFilterSettingsService);
  private readonly location = inject(Location);

  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly ageMin = signal<number | null>(null);
  readonly ageMax = signal<number | null>(null);
  readonly selectedGenders = signal<string[]>([]);
  readonly sameNativeLanguage = signal(false);
  readonly sameTargetLanguage = signal(false);
  readonly sameGender = signal(false);
  readonly sameAge = signal(false);

  readonly genderOptions = GENDER_OPTIONS;

  readonly hasFilters = computed(
    () =>
      this.ageMin() !== null ||
      this.ageMax() !== null ||
      this.selectedGenders().length > 0 ||
      this.sameNativeLanguage() ||
      this.sameTargetLanguage() ||
      this.sameGender() ||
      this.sameAge(),
  );

  async ngOnInit(): Promise<void> {
    try {
      const filters = await this.filtersService.getFilters();
      if (filters.enabled && !filters.allowEveryone) {
        this.ageMin.set(filters.ageMin ?? null);
        this.ageMax.set(filters.ageMax ?? null);
        this.selectedGenders.set(filters.allowedGenders ?? []);
        this.sameNativeLanguage.set(filters.sameNativeLanguage ?? false);
        this.sameTargetLanguage.set(filters.sameTargetLanguage ?? false);
        this.sameGender.set(filters.sameGender ?? false);
        this.sameAge.set(filters.sameAge ?? false);
      }
    } catch {
      this.errorMessage.set('settings.messageFilters.loadError');
    } finally {
      this.isLoading.set(false);
    }
  }

  selectEveryone(): void {
    this.ageMin.set(null);
    this.ageMax.set(null);
    this.selectedGenders.set([]);
    this.sameNativeLanguage.set(false);
    this.sameTargetLanguage.set(false);
    this.sameGender.set(false);
    this.sameAge.set(false);
  }

  toggleGender(code: string): void {
    this.selectedGenders.update((current) =>
      current.includes(code) ? current.filter((value) => value !== code) : [...current, code],
    );
  }

  async saveFilters(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (
      this.ageMin() !== null &&
      this.ageMax() !== null &&
      Number(this.ageMin()) > Number(this.ageMax())
    ) {
      this.errorMessage.set('settings.messageFilters.invalidAgeRange');
      return;
    }

    this.isSaving.set(true);
    try {
      const enabled = this.hasFilters();
      await this.filtersService.saveFilters({
        enabled,
        allowEveryone: !enabled,
        allowedGenders: this.selectedGenders(),
        sameNativeLanguage: this.sameNativeLanguage(),
        sameTargetLanguage: this.sameTargetLanguage(),
        sameGender: this.sameGender(),
        sameAge: this.sameAge(),
        ageMin: this.ageMin() ?? undefined,
        ageMax: this.ageMax() ?? undefined,
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
}
