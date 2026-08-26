import { Component, computed, inject, output, signal } from '@angular/core';
import { HlmCheckbox } from '@spartan-ng/helm/checkbox';
import { TranslatePipe } from '../../../services/translate.pipe';
import { I18nService } from '../../../services/i18n.service';
import { SearchFilterParams } from '../../../services/discovery.service';
import { AppButtonPrimaryComponent } from '../../primitives/button-primary/button-primary.component';
import {
  ALL_LANGUAGE_CODES,
  getLanguageFlag,
} from '../../primitives/language-picker/language-picker.component';
import { AppSelectComponent } from '../../primitives/select/select.component';
import { RecommendedForYouCarouselComponent } from '../recommended-for-you/recommended-for-you-carousel.component';

export interface TranslatedLanguage {
  code: string;
  translatedName: string;
  nativeName: string;
  flag: string;
}

@Component({
  selector: 'app-global-search',
  imports: [
    HlmCheckbox,
    TranslatePipe,
    AppButtonPrimaryComponent,
    AppSelectComponent,
    RecommendedForYouCarouselComponent,
  ],
  templateUrl: './global-search.component.html',
  styleUrls: ['./global-search.component.scss'],
})
export class GlobalSearchComponent {
  readonly i18n = inject(I18nService);

  readonly searchFilters = output<SearchFilterParams>();

  readonly nativeLanguages = signal<string>('');
  readonly targetLanguage = signal<string>('');
  readonly level = signal<string>('');
  readonly hasAudioIntro = signal<boolean>(false);
  readonly audioIntroId = `global-hasAudioIntro-${crypto.randomUUID()}`;

  readonly levels = [
    { value: 'a1', key: 'levels.a1' },
    { value: 'a2', key: 'levels.a2' },
    { value: 'b1', key: 'levels.b1' },
    { value: 'b2', key: 'levels.b2' },
    { value: 'c1', key: 'levels.c1' },
    { value: 'c2', key: 'levels.c2' },
  ];

  readonly availableLanguages = computed<TranslatedLanguage[]>(() => {
    const uiLang = this.i18n.currentLang();
    const uiLangShort = uiLang.split('-')[0];
    let displayNames: Intl.DisplayNames;
    try {
      displayNames = new Intl.DisplayNames([uiLangShort], { type: 'language' });
    } catch {
      displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
    }

    return ALL_LANGUAGE_CODES.map((code) => {
      let translatedName: string;
      try {
        translatedName = displayNames.of(code) || code.toUpperCase();
      } catch {
        translatedName = code.toUpperCase();
      }
      let nativeName: string;
      try {
        const nativeDisplay = new Intl.DisplayNames([code], { type: 'language' });
        nativeName = nativeDisplay.of(code) || code.toUpperCase();
      } catch {
        nativeName = code.toUpperCase();
      }
      return { code, translatedName, nativeName, flag: getLanguageFlag(code) };
    }).sort((a, b) => a.translatedName.localeCompare(b.translatedName));
  });

  applyFilters(): void {
    this.searchFilters.emit({
      native_languages: this.nativeLanguages(),
      target_language: this.targetLanguage(),
      proficiency_level: this.level(),
      has_audio_intro: this.hasAudioIntro(),
    });
  }

  onAudioIntroChange(checked: boolean): void {
    this.hasAudioIntro.set(checked);
    this.applyFilters();
  }
}
