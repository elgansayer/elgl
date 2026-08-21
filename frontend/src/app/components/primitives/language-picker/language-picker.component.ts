import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { TranslatePipe } from '../../../services/translate.pipe';

export const ALL_LANGUAGE_CODES = [
  'ab', 'aa', 'af', 'ak', 'sq', 'am', 'ar', 'an', 'hy', 'as', 'av', 'ae', 'ay', 'az', 'bm', 'ba',
  'eu', 'be', 'bn', 'bh', 'bi', 'bs', 'br', 'bg', 'my', 'ca', 'ch', 'ce', 'ny', 'zh', 'cv', 'kw',
  'co', 'cr', 'hr', 'cs', 'da', 'dv', 'nl', 'dz', 'en', 'eo', 'et', 'ee', 'fo', 'fj', 'fi', 'fr',
  'ff', 'gl', 'ka', 'de', 'el', 'gn', 'gu', 'ht', 'ha', 'he', 'hz', 'hi', 'ho', 'hu', 'ia', 'id',
  'ie', 'ga', 'ig', 'ik', 'io', 'is', 'it', 'iu', 'ja', 'jv', 'kl', 'kn', 'kr', 'ks', 'kk', 'km',
  'ki', 'rw', 'ky', 'kv', 'kg', 'ko', 'ku', 'kj', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu',
  'lv', 'gv', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mh', 'mn', 'na', 'nv', 'nd', 'ne', 'ng',
  'nb', 'nn', 'no', 'ii', 'nr', 'oc', 'oj', 'cu', 'om', 'or', 'os', 'pa', 'pi', 'fa', 'pl', 'ps',
  'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'sa', 'sc', 'sd', 'se', 'sm', 'sg', 'sr', 'gd', 'sn', 'si',
  'sk', 'sl', 'so', 'st', 'es', 'su', 'sw', 'ss', 'sv', 'ta', 'te', 'tg', 'th', 'ti', 'bo', 'tk',
  'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty', 'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa',
  'cy', 'wo', 'fy', 'xh', 'yi', 'yo', 'za', 'zu',
];

export function getLanguageFlag(code: string): string {
  const flags: Record<string, string> = {
    en: '🇬🇧', es: '🇪🇸', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', pt: '🇵🇹', ja: '🇯🇵', ko: '🇰🇷',
    zh: '🇨🇳', ar: '🇸🇦', ru: '🇷🇺', hi: '🇮🇳', tr: '🇹🇷', no: '🇳🇴', nl: '🇳🇱', el: '🇬🇷',
    uk: '🇺🇦', ur: '🇵🇰', sw: '🇰🇪', vi: '🇻🇳', pl: '🇵🇱', he: '🇮🇱', fa: '🇮🇷', sv: '🇸🇪',
    fi: '🇫🇮', da: '🇩🇰', id: '🇮🇩', th: '🇹🇭', ms: '🇲🇾', cs: '🇨🇿', hu: '🇭🇺', ro: '🇷🇴',
    bg: '🇧🇬', hr: '🇭🇷', sk: '🇸🇰', sr: '🇷🇸', sl: '🇸🇮', sq: '🇦🇱', mk: '🇲🇰', bs: '🇧🇦',
  };
  return flags[code.toLowerCase()] || '🌍';
}

export interface LanguageItem {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-language-picker',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmInputImports],
  templateUrl: './language-picker.component.html',
})
export class LanguagePickerComponent {
  selectedCode = input<string | null>(null);
  languageSelected = output<string>();

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');

  readonly allLanguages = computed(() => {
    try {
      const enNames = new Intl.DisplayNames(['en'], { type: 'language' });
      return ALL_LANGUAGE_CODES.map((code) => {
        let name = code;
        let nativeName = code;
        try {
          name = enNames.of(code) || code;
          const nativeDisplay = new Intl.DisplayNames([code], { type: 'language' });
          nativeName = nativeDisplay.of(code) || name;
        } catch {
          // fall back to code/name
        }
        return { code, name, nativeName, flag: getLanguageFlag(code) };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } catch {
      return ALL_LANGUAGE_CODES.map((code) => ({
        code,
        name: code,
        nativeName: code,
        flag: getLanguageFlag(code),
      }));
    }
  });

  readonly filteredLanguages = computed(() => {
    const query = this.searchQuery().toLowerCase().trim();
    const langs = this.allLanguages();
    if (!query) return langs;
    return langs.filter(
      (language) =>
        language.name.toLowerCase().includes(query) ||
        language.nativeName.toLowerCase().includes(query) ||
        language.code.toLowerCase().includes(query),
    );
  });

  readonly selectedLanguage = computed(() => {
    const code = this.selectedCode();
    if (!code) return null;
    return this.allLanguages().find((language) => language.code === code) || null;
  });

  openModal(): void {
    this.isOpen.set(true);
    this.searchQuery.set('');
  }

  closeModal(): void {
    this.isOpen.set(false);
  }

  selectLanguage(code: string): void {
    this.languageSelected.emit(code);
    this.closeModal();
  }

  onSearchInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.searchQuery.set(target.value);
  }
}
