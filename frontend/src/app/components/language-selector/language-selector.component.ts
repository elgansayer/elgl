import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { Component, computed, inject, signal } from '@angular/core';
import { I18nService, LanguageInfo } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { UiLanguagePreferenceService } from '../../services/ui-language-preference.service';

@Component({
  selector: 'app-language-selector',
  imports: [HlmInput, HlmButton, TranslatePipe],
  templateUrl: './language-selector.component.html',
})
export class LanguageSelectorComponent {
  private readonly i18n = inject(I18nService);
  private readonly languagePreference = inject(UiLanguagePreferenceService);

  readonly isOpen = signal(false);
  readonly isChanging = signal(false);
  readonly hasError = signal(false);
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
    this.hasError.set(false);
    this.isOpen.update((open) => !open);
  }

  close(): void {
    this.hasError.set(false);
    this.isOpen.set(false);
  }

  getLanguageAriaLabel(lang: LanguageInfo): string {
    const isSelected = lang.code === this.currentLang();
    return isSelected ? `${lang.name}, ${this.i18n.translate('common.selected')}` : lang.name;
  }

  /**
   * Applies the chosen interface language through the transactional preference
   * boundary. The list closes only once the new dictionary is active; on failure
   * the previous language is restored and an alert is shown so the user can retry.
   */
  async selectLanguage(code: string): Promise<void> {
    if (this.isChanging()) return;

    this.hasError.set(false);
    this.isChanging.set(true);
    try {
      await this.languagePreference.changeLanguage(code);
      this.isOpen.set(false);
      this.searchQuery.set('');
    } catch {
      this.hasError.set(true);
    } finally {
      this.isChanging.set(false);
    }
  }

  onSearch(event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.searchQuery.set(input.value);
    }
  }
}
