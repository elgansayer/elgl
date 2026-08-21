import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-language-settings',
  standalone: true,
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="min-h-screen bg-surface-50">
      <header
        class="sticky top-0 z-10 flex items-center justify-between bg-surface-100 ps-4 pe-4 pt-4 pb-4 border-b border-surface-200"
      >
        <div class="flex items-center gap-3">
          <button
            hlmBtn
            (click)="goBack()"
            class="p-2 -ms-2 rounded-full hover:bg-surface-200 transition-colors"
            [attr.aria-label]="'common.back' | t"
          >
            <span class="text-xl">←</span>
          </button>
          <h1 class="text-xl font-bold text-text-primary">
            {{ 'languageSettings.title' | t }}
          </h1>
        </div>
      </header>

      <main class="max-w-3xl mx-auto ps-4 pe-4 pt-6 pb-20 space-y-8">
        <p class="text-sm text-text-secondary">
          {{ 'languageSettings.description' | t }}
        </p>

        <section class="space-y-4">
          <h2 class="text-sm font-bold uppercase text-text-secondary tracking-wider">
            {{ 'languageSettings.interfaceLanguage' | t }}
          </h2>
          <p class="text-xs text-text-secondary">
            {{ 'languageSettings.interfaceLanguageDescription' | t }}
          </p>

          <div
            class="rounded-2xl bg-surface-100 border border-surface-200 overflow-hidden shadow-sm"
          >
            @for (lang of langs; track lang.code) {
              <button
                hlmBtn
                type="button"
                (click)="selectLang(lang.code)"
                class="w-full flex items-center justify-between p-4 hover:bg-surface-200 transition-colors border-b border-surface-200 last:border-b-0"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">{{ lang.flag }}</span>
                  <div class="text-start">
                    <div class="text-sm font-medium text-text-primary">{{ lang.nativeName }}</div>
                    <div class="text-xs text-text-secondary">{{ lang.name }}</div>
                  </div>
                </div>
                @if (currentLang() === lang.code) {
                  <span
                    class="inline-flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full"
                  >
                    ✓ {{ 'common.selected' | t }}
                  </span>
                }
              </button>
            }
          </div>
        </section>
      </main>
    </div>
  `,
})
export class LanguageSettingsComponent {
  private location = inject(Location);
  readonly i18n = inject(I18nService);

  readonly langs = this.i18n.availableLanguages;
  readonly currentLang = this.i18n.currentLang;

  async selectLang(code: string): Promise<void> {
    await this.i18n.setLanguage(code);
  }

  goBack(): void {
    this.location.back();
  }
}
