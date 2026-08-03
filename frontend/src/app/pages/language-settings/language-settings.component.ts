import { Component, inject } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-language-settings',
  imports: [TranslatePipe],
  template: `
    <div class="max-w-md mx-auto p-4">
      <h1 class="text-2xl font-bold mb-4">{{ 'languageSettings.title' | t }}</h1>
      <p class="text-muted mb-6">{{ 'languageSettings.description' | t }}</p>

      <h2 class="text-lg font-semibold mb-2">{{ 'languageSettings.selectLabel' | t }}</h2>

      <ul class="space-y-2">
        @for (lang of langs; track lang.code) {
          <li
            role="button"
            tabindex="0"
            class="flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors"
            [class.selected]="currentLang() === lang.code"
            (click)="selectLang(lang.code)"
            (keydown.enter)="selectLang(lang.code)"
          >
            <span class="flex items-center gap-2">
              <span class="text-xl">{{ lang.flag }}</span>
              <span>{{ lang.nativeName }}</span>
              <span class="text-xs text-muted ms-auto">({{ lang.name }})</span>
            </span>
            @if (currentLang() === lang.code) {
              <span class="text-xs text-green-500 ms-2">{{ 'languageSettings.currentLang' | t : { name: lang.nativeName } }}</span>
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: [
    `
      :host .selected {
        background-color: rgba(99, 102, 241, 0.2); /* indigo‑500/20 */
      }
    `,
  ],
})
export class LanguageSettingsComponent {
  readonly i18n = inject(I18nService);

  readonly langs = this.i18n.availableLanguages;
  readonly currentLang = this.i18n.currentLang;

  async selectLang(code: string): Promise<void> {
    await this.i18n.setLanguage(code);
  }
}
