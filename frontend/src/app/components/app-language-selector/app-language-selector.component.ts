import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-app-language-selector',
  imports: [HlmButton, TranslatePipe],
  templateUrl: './app-language-selector.component.html',
})
export class AppLanguageSelectorComponent {
  readonly i18n = inject(I18nService);
  readonly currentLang = this.i18n.currentLang;
  readonly availableLanguages = this.i18n.availableLanguages;
  readonly isOpen = signal(false);

  toggleModal(): void {
    this.isOpen.update((open) => !open);
  }

  closeModal(): void {
    this.isOpen.set(false);
  }

  async selectLanguage(code: string): Promise<void> {
    await this.i18n.setLanguage(code);
    this.closeModal();
  }
}
