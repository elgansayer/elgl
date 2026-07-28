import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-language-selector',
  imports: [TranslatePipe],
  templateUrl: './language-selector.component.html',
})
export class LanguageSelectorComponent {
  readonly i18n = inject(I18nService);
  readonly isOpen = signal(false);
  readonly isSwitching = signal(false);

  toggleModal(): void {
    this.isOpen.update((v) => !v);
  }

  closeModal(): void {
    this.isOpen.set(false);
  }

  async selectLanguage(code: string): Promise<void> {
    if (!code) return;
    this.isSwitching.set(true);
    await this.i18n.setLanguage(code);
    this.isSwitching.set(false);
    this.closeModal();
  }
}
