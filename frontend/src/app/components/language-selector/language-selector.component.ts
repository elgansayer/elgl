import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, signal } from '@angular/core';
import { I18nService, LanguageInfo } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-language-selector',
  imports: [HlmInput, HlmButton, TranslatePipe],
  templateUrl: './language-selector.component.html',
})
export class LanguageSelectorComponent {
  private readonly i18n = inject(I18nService);

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');
  readonly currentLang = computed(() => this.i18n.currentLang());

  readonly currentLanguage = computed<LanguageInfo>(() => {
    const code = this.currentLang();
    const match = this.i18n.availableLanguages.find((l) => l.code === code);
    if (match) return match;
    return { code, name: code, nativeName: code, flag: '🌐', isRtl: false };
  });

  readonly filteredLanguages = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const langs = this.i18n.availableLanguages;
    if (!query) return langs;
    return langs.filter((lang) => {
      const haystack = `${lang.name} ${lang.nativeName} ${lang.code}`.toLowerCase();
      return haystack.includes(query);
    });
  });

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  selectLanguage(code: string): void {
    this.i18n.setLanguage(code);
    this.isOpen.set(false);
    this.searchQuery.set('');
  }

  onSearch(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.searchQuery.set(input.value);
    }
  }
}
