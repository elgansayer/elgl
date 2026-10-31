import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { UiLanguagePreferenceService } from '../../services/ui-language-preference.service';

@Component({
  selector: 'app-app-language-selector',
  imports: [HlmButton, TranslatePipe],
  templateUrl: './app-language-selector.component.html',
})
export class AppLanguageSelectorComponent {
  private readonly languagePreference = inject(UiLanguagePreferenceService);

  readonly currentLang = this.languagePreference.currentLang;
  readonly availableLanguages = this.languagePreference.availableLanguages;
  readonly isOpen = signal(false);
  readonly isChanging = signal(false);
  readonly hasError = signal(false);

  toggleModal(): void {
    this.hasError.set(false);
    this.isOpen.update((open) => !open);
  }

  closeModal(): void {
    this.hasError.set(false);
    this.isOpen.set(false);
  }

  /**
   * Applies the chosen interface language through the transactional preference
   * boundary. The modal closes only once the new dictionary is active; on failure
   * the previous language is restored and the modal stays open with an alert so
   * the user can retry or pick another language.
   */
  async selectLanguage(code: string): Promise<void> {
    if (this.isChanging()) return;

    if (code === this.currentLang()) {
      this.closeModal();
      return;
    }

    this.hasError.set(false);
    this.isChanging.set(true);
    try {
      await this.languagePreference.changeLanguage(code);
      this.closeModal();
    } catch {
      this.hasError.set(true);
    } finally {
      this.isChanging.set(false);
    }
  }
}
