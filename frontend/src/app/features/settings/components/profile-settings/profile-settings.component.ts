import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormArray, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { TranslatePipe } from '../../../../services/translate.pipe';
import { SettingsService } from '../../../../core/services/settings.service';
import { UserService } from '../../../../services/user.service';
import {
  LanguageLevel,
  JLPTLevel,
  ProfileDiscoverySettings,
} from '../../../../core/models/settings.model';

function isHTMLInputElement(element: EventTarget | null): element is HTMLInputElement {
  return element !== null && 'value' in element;
}

interface TargetLanguageFormEntry {
  language?: unknown;
  level?: unknown;
  jlptLevel?: unknown;
}

const isLanguageLevel = (level: unknown): level is LanguageLevel => {
  return (
    typeof level === 'string' &&
    ['Beginner', 'Elementary', 'Intermediate', 'Upper Intermediate', 'Advanced', 'Native'].includes(
      level,
    )
  );
};

const isJLPTLevel = (level: unknown): level is JLPTLevel => {
  return typeof level === 'string' && ['N5', 'N4', 'N3', 'N2', 'N1', 'None'].includes(level);
};

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="space-y-6">
      <form [formGroup]="profileForm" class="space-y-6">

        <!-- Bio Section -->
        <section class="space-y-4">
          <h2 id="profile-bio-heading" class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'profile.bioLabel' | t }}
          </h2>
          <div class="rounded-2xl bg-surface-100 border border-surface-200 p-4 shadow-sm">
            <textarea
              formControlName="bio"
              class="w-full bg-surface-200 border border-surface-300 rounded-lg p-3 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30 min-h-[100px] resize-y"
              [placeholder]="'profile.bioPlaceholder' | t"
              [attr.aria-label]="'profile.bioLabel' | t"
            ></textarea>
          </div>
        </section>

        <!-- Languages Section -->
        <section class="space-y-4">
          <h2 id="profile-languages-heading" class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'profile.languagesLabel' | t }}
          </h2>
          <div class="rounded-2xl bg-surface-100 border border-surface-200 p-4 shadow-sm space-y-4">

            <!-- Native Language -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-text-primary">{{ 'profile.nativeLanguage' | t }}</label>
              <input
                type="text"
                formControlName="nativeLanguage"
                class="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <!-- Target Languages (FormArray) -->
            <div class="space-y-3">
              <label class="block text-sm font-medium text-text-primary">{{ 'profile.targetLanguages' | t }}</label>

              <div formArrayName="targetLanguages" class="space-y-3">
                @for (targetLang of targetLanguages.controls; track $index) {
                  <div [formGroupName]="$index" class="p-3 bg-surface-200 rounded-lg border border-surface-300 space-y-3 relative">
                    <button
                      type="button"
                      (click)="removeTargetLanguage($index)"
                      class="absolute top-2 end-2 text-text-secondary hover:text-error transition-colors"
                      [attr.aria-label]="'common.remove' | t"
                    >
                      <span class="material-icons text-sm">close</span>
                    </button>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pe-6">
                      <div>
                        <label class="block text-xs text-text-secondary mb-1">{{ 'profile.language' | t }}</label>
                        <input
                          type="text"
                          formControlName="language"
                          class="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <div>
                        <label class="block text-xs text-text-secondary mb-1">{{ 'profile.level' | t }}</label>
                        <select
                          formControlName="level"
                          class="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30"
                        >
                          <option value="Beginner">{{ 'profile.levelBeginner' | t }}</option>
                          <option value="Elementary">{{ 'profile.levelElementary' | t }}</option>
                          <option value="Intermediate">{{ 'profile.levelIntermediate' | t }}</option>
                          <option value="Upper Intermediate">{{ 'profile.levelUpperIntermediate' | t }}</option>
                          <option value="Advanced">{{ 'profile.levelAdvanced' | t }}</option>
                          <option value="Native">{{ 'profile.levelNative' | t }}</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label class="block text-xs text-text-secondary mb-1">JLPT</label>
                      <select
                        formControlName="jlptLevel"
                        class="w-full bg-surface-100 border border-surface-300 rounded-md px-2 py-1 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="None">None</option>
                        <option value="N5">N5</option>
                        <option value="N4">N4</option>
                        <option value="N3">N3</option>
                        <option value="N2">N2</option>
                        <option value="N1">N1</option>
                      </select>
                    </div>
                  </div>
                }
              </div>

              <button
                type="button"
                (click)="addTargetLanguage()"
                class="text-sm text-primary font-medium hover:underline flex items-center gap-1"
              >
                <span class="material-icons text-sm">add</span>
                {{ 'profile.addTargetLanguage' | t }}
              </button>
            </div>

            <label class="flex items-center justify-between py-2 cursor-pointer hover:bg-surface-200 transition-colors rounded px-2 -mx-2">
              <span class="text-sm font-medium text-text-primary">{{ 'profile.displayKana' | t }}</span>
              <input
                type="checkbox"
                formControlName="displayKana"
                class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30"
              />
            </label>
          </div>
        </section>

        <!-- Discovery & Matching Section -->
        <section class="space-y-4">
          <h2 id="profile-discovery-heading" class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'profile.discoveryLabel' | t }}
          </h2>
          <div class="rounded-2xl bg-surface-100 border border-surface-200 p-4 shadow-sm space-y-6">

            <!-- Age Filter -->
            <div formGroupName="ageFilter" class="space-y-2">
              <label class="block text-sm font-medium text-text-primary">{{ 'profile.ageFilter' | t }}</label>
              <div class="flex items-center gap-4">
                <div class="flex-1">
                  <label class="text-xs text-text-secondary">{{ 'common.min' | t }}</label>
                  <input type="number" formControlName="min" min="18" class="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30">
                </div>
                <div class="flex-1">
                  <label class="text-xs text-text-secondary">{{ 'common.max' | t }}</label>
                  <input type="number" formControlName="max" min="18" class="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30">
                </div>
              </div>
            </div>

            <!-- Distance Radius (Signal driven) -->
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label class="block text-sm font-medium text-text-primary">{{ 'profile.distanceRadius' | t }}</label>
                <span class="text-sm text-text-secondary">{{ distanceRadius() }} km</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                [value]="distanceRadius()"
                (change)="onDistanceChange($event)"
                class="w-full h-2 bg-surface-300 rounded-lg appearance-none cursor-pointer accent-primary"
                [attr.aria-label]="'profile.distanceRadius' | t"
              />
            </div>

            <!-- Matching Preferences -->
            <div formGroupName="matchingPreferences" class="space-y-4 pt-4 border-t border-surface-300">
              <label class="block text-sm font-medium text-text-primary">{{ 'profile.matchingPreferences' | t }}</label>

              <div class="flex items-center justify-between">
                <span class="text-sm text-text-secondary">{{ 'profile.genderPreference' | t }}</span>
                <select
                  formControlName="gender"
                  class="bg-surface-200 border border-surface-300 rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="Any">{{ 'common.any' | t }}</option>
                  <option value="Male">{{ 'common.male' | t }}</option>
                  <option value="Female">{{ 'common.female' | t }}</option>
                  <option value="Non-binary">{{ 'common.nonBinary' | t }}</option>
                </select>
              </div>

              <label class="flex items-center justify-between cursor-pointer hover:bg-surface-200 transition-colors rounded px-2 -mx-2 py-1">
                <span class="text-sm text-text-secondary">{{ 'profile.onlyVerified' | t }}</span>
                <input
                  type="checkbox"
                  formControlName="onlyVerified"
                  class="h-5 w-5 rounded border-surface-300 text-primary focus:ring-primary/30"
                />
              </label>
            </div>

          </div>
        </section>

      </form>
    </div>
  `,
})
export class ProfileSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);
  private userService = inject(UserService);

  distanceRadius = signal<number>(50);

  profileForm = this.fb.group({
    bio: ['', [Validators.maxLength(500)]],
    nativeLanguage: [''],
    targetLanguages: this.fb.array([]),
    displayKana: [false],
    ageFilter: this.fb.group({
      min: [18, [Validators.min(18)]],
      max: [100, [Validators.max(120)]],
    }),
    matchingPreferences: this.fb.group({
      gender: ['Any'],
      onlyVerified: [false],
    }),
  });

  get targetLanguages(): FormArray {
    const array = this.profileForm.get('targetLanguages');
    if (array instanceof FormArray) {
      return array;
    }
    throw new Error('targetLanguages is not a FormArray');
  }

  constructor() {
    const current = this.settingsService.settings();
    if (!current) {
      this.settingsService.loadSettings('current-user');
    }

    void this.loadFromApi();
  }

  ngOnInit() {
    const data = this.settingsService.profileSettings();
    if (data) {
      this.populateFormFromSettings(data);
    }

    this.profileForm.valueChanges.pipe(debounceTime(500)).subscribe(() => {
      if (this.profileForm.valid) {
        this.persist();
      }
    });
  }

  private async loadFromApi() {
    try {
      const profile = await this.userService.getMyProfile();
      if (profile) {
        this.profileForm.patchValue(
          {
            bio: profile.bio_text ?? '',
            nativeLanguage: profile.native_languages?.[0] ?? '',
          },
          { emitEvent: false },
        );

        while (this.targetLanguages.length !== 0) {
          this.targetLanguages.removeAt(0, { emitEvent: false });
        }
        if (profile.target_languages) {
          for (const lang of profile.target_languages) {
            this.targetLanguages.push(
              this.fb.group({
                language: [lang, Validators.required],
                level: ['Beginner', Validators.required],
                jlptLevel: ['None'],
              }),
              { emitEvent: false },
            );
          }
        }
      }
    } catch {
      // Fall back to settings service data
    }
  }

  private populateFormFromSettings(data: ProfileDiscoverySettings) {
    this.profileForm.patchValue(
      {
        bio: data.bio,
        nativeLanguage: data.nativeLanguage,
        displayKana: data.displayKana,
        ageFilter: data.ageFilter,
        matchingPreferences: data.matchingPreferences,
      },
      { emitEvent: false },
    );

    this.distanceRadius.set(data.distanceRadiusKm);

    while (this.targetLanguages.length !== 0) {
      this.targetLanguages.removeAt(0);
    }

    data.targetLanguages.forEach((lang) => {
      this.targetLanguages.push(
        this.fb.group({
          language: [lang.language, Validators.required],
          level: [lang.level, Validators.required],
          jlptLevel: [lang.jlptLevel],
        }),
      );
    });
  }

  addTargetLanguage() {
    this.targetLanguages.push(
      this.fb.group({
        language: ['', Validators.required],
        level: ['Beginner', Validators.required],
        jlptLevel: ['None'],
      }),
    );
    this.persist();
  }

  removeTargetLanguage(index: number) {
    this.targetLanguages.removeAt(index);
    this.persist();
  }

  onDistanceChange(event: Event) {
    const input = event.target;
    if (isHTMLInputElement(input)) {
      const value = parseInt(input.value, 10);
      this.distanceRadius.set(value);
      this.persist();
    }
  }

  private persist() {
    if (this.profileForm.invalid) return;

    const formValue = this.profileForm.value;

    let genderVal: 'Any' | 'Male' | 'Female' | 'Non-binary' = 'Any';
    const rawGender = formValue.matchingPreferences?.gender;
    if (
      rawGender === 'Any' ||
      rawGender === 'Male' ||
      rawGender === 'Female' ||
      rawGender === 'Non-binary'
    ) {
      genderVal = rawGender;
    }

    const tLangs: Array<{ language: string; level: LanguageLevel; jlptLevel?: JLPTLevel }> = [];
    if (Array.isArray(formValue.targetLanguages)) {
      for (const raw of formValue.targetLanguages) {
        const lang: TargetLanguageFormEntry = typeof raw === 'object' && raw !== null ? raw : {};
        let lvlVal: LanguageLevel = 'Beginner';
        if (isLanguageLevel(lang.level)) {
          lvlVal = lang.level;
        }
        let jlptVal: JLPTLevel | undefined = undefined;
        if (isJLPTLevel(lang.jlptLevel)) {
          jlptVal = lang.jlptLevel;
        }
        tLangs.push({
          language: String(lang.language || ''),
          level: lvlVal,
          jlptLevel: jlptVal,
        });
      }
    }

    const newSettings: Partial<ProfileDiscoverySettings> = {
      bio: formValue.bio || '',
      nativeLanguage: formValue.nativeLanguage || '',
      targetLanguages: tLangs,
      displayKana: formValue.displayKana || false,
      ageFilter: {
        min: formValue.ageFilter?.min || 18,
        max: formValue.ageFilter?.max || 100,
      },
      distanceRadiusKm: this.distanceRadius(),
      matchingPreferences: {
        gender: genderVal,
        onlyVerified: formValue.matchingPreferences?.onlyVerified || false,
      },
    };

    this.settingsService.updateProfileSettings(newSettings);

    // Sync to backend API via UserService
    const bioText = formValue.bio || '';
    const nativeLang = formValue.nativeLanguage || '';
    const targetLangStrings = tLangs.map((l) => l.language).filter((l) => l.length > 0);

    void this.userService.updateMyProfile({
      bio_text: bioText || undefined,
      native_languages: nativeLang ? [nativeLang] : undefined,
      target_languages: targetLangStrings.length > 0 ? targetLangStrings : undefined,
    });
  }
}
