import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormArray, Validators } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { TranslatePipe } from '../../../../services/translate.pipe';
import { SettingsService } from '../../../../core/services/settings.service';
import { LanguageLevel, JLPTLevel, ProfileDiscoverySettings } from '../../../../core/models/settings.model';
function isHTMLInputElement(element: EventTarget | null): element is HTMLInputElement {
  return element !== null && 'value' in element;
}

const isLanguageLevel = (level: unknown): level is LanguageLevel => {
    return typeof level === 'string' && ['Beginner', 'Elementary', 'Intermediate', 'Upper Intermediate', 'Advanced', 'Native'].includes(level);
};

const isJLPTLevel = (level: unknown): level is JLPTLevel => {
    return typeof level === 'string' && ['N5', 'N4', 'N3', 'N2', 'N1', 'None'].includes(level);
};

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './profile-settings.component.html',
})
export class ProfileSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private settingsService = inject(SettingsService);

  distanceRadius = signal<number>(50);

  profileForm = this.fb.group({
    bio: ['', [Validators.maxLength(500)]],
    nativeLanguage: [''],
    targetLanguages: this.fb.array([]),
    displayKana: [false],
    ageFilter: this.fb.group({
      min: [18, [Validators.min(18)]],
      max: [100, [Validators.max(120)]]
    }),
    matchingPreferences: this.fb.group({
      gender: ['Any'],
      onlyVerified: [false]
    })
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
  }

  ngOnInit() {
    const data = this.settingsService.profileSettings();
    if (data) {
      this.profileForm.patchValue({
        bio: data.bio,
        nativeLanguage: data.nativeLanguage,
        displayKana: data.displayKana,
        ageFilter: data.ageFilter,
        matchingPreferences: data.matchingPreferences
      }, { emitEvent: false });

      this.distanceRadius.set(data.distanceRadiusKm);

      // Clear and rebuild array
      while (this.targetLanguages.length !== 0) {
        this.targetLanguages.removeAt(0);
      }

      data.targetLanguages.forEach(lang => {
        this.targetLanguages.push(this.fb.group({
          language: [lang.language, Validators.required],
          level: [lang.level, Validators.required],
          jlptLevel: [lang.jlptLevel]
        }));
      });
    }

    this.profileForm.valueChanges.pipe(debounceTime(500)).subscribe(() => {
      if (this.profileForm.valid) {
        this.persist();
      }
    });
  }

  addTargetLanguage() {
    this.targetLanguages.push(this.fb.group({
      language: ['', Validators.required],
      level: ['Beginner', Validators.required],
      jlptLevel: ['None']
    }));
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

    // Construct the settings object matching the model

    let genderVal: 'Any' | 'Male' | 'Female' | 'Non-binary' = 'Any';
    const rawGender = formValue.matchingPreferences?.gender;
    if (rawGender === 'Any' || rawGender === 'Male' || rawGender === 'Female' || rawGender === 'Non-binary') {
        genderVal = rawGender;
    }

    const tLangs: Array<{ language: string; level: LanguageLevel; jlptLevel?: JLPTLevel; }> = [];
    if (Array.isArray(formValue.targetLanguages)) {
        for (const rawLang of formValue.targetLanguages) {
            const lang = rawLang as Record<string, unknown>;
            let lvlVal: LanguageLevel = 'Beginner';
            if (isLanguageLevel(lang['level'])) {
                lvlVal = lang['level'];
            }
            let jlptVal: JLPTLevel | undefined = undefined;
            if (isJLPTLevel(lang['jlptLevel'])) {
                jlptVal = lang['jlptLevel'];
            }
            tLangs.push({
                language: String(lang['language'] || ''),
                level: lvlVal,
                jlptLevel: jlptVal
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
        max: formValue.ageFilter?.max || 100
      },
      distanceRadiusKm: this.distanceRadius(),
      matchingPreferences: {
        gender: genderVal,
        onlyVerified: formValue.matchingPreferences?.onlyVerified || false
      }
    };

    this.settingsService.updateProfileSettings(newSettings);
  }
}
