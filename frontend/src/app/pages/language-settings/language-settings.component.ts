import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadio, HlmRadioGroup } from '@spartan-ng/helm/radio-group';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-language-settings',
  imports: [HlmButton, HlmRadio, HlmRadioGroup, TranslatePipe],
  template: `
    <div class="min-h-screen bg-surface-50">
      <header
        class="sticky top-0 z-10 flex items-center justify-between border-b border-surface-200 bg-surface-100 ps-4 pe-4 pt-4 pb-4"
      >
        <div class="flex min-w-0 items-center gap-3">
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="icon-touch"
            (click)="goBack()"
            [attr.aria-label]="'common.back' | t"
          >
            <span class="text-xl" aria-hidden="true">←</span>
          </button>
          <h1 id="language-settings-title" class="min-w-0 text-xl font-bold text-text-primary">
            {{ 'languageSettings.title' | t }}
          </h1>
        </div>
      </header>

      <main
        class="mx-auto max-w-3xl space-y-8 ps-4 pe-4 pt-6 pb-20"
        aria-labelledby="language-settings-title"
        [attr.aria-busy]="isChanging() ? 'true' : null"
      >
        <p class="text-sm text-text-secondary">
          {{ 'languageSettings.description' | t }}
        </p>

        @if (hasError()) {
          <p role="alert" class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {{ 'common.error_generic' | t }}
          </p>
        }

        <section class="space-y-4" aria-labelledby="interface-language-heading">
          <h2
            id="interface-language-heading"
            class="text-sm font-bold uppercase tracking-wider text-text-secondary"
          >
            {{ 'languageSettings.interfaceLanguage' | t }}
          </h2>
          <p id="interface-language-description" class="text-xs text-text-secondary">
            {{ 'languageSettings.interfaceLanguageDescription' | t }}
          </p>

          <hlm-radio-group
            name="interface-language"
            [value]="currentLang()"
            [disabled]="isChanging()"
            (valueChange)="onLanguageValueChange($event)"
            aria-labelledby="interface-language-heading"
            aria-describedby="interface-language-description"
            class="overflow-hidden rounded-card border border-surface-200 bg-surface-100 shadow-card"
          >
            @for (lang of langs; track lang.code) {
              <hlm-radio
                [value]="lang.code"
                [aria-label]="lang.nativeName"
                class="min-h-11 w-full cursor-pointer justify-between border-b border-surface-200 ps-4 pe-4 pt-3 pb-3 text-text-primary transition-colors last:border-b-0 hover:bg-surface-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset data-[checked=true]:bg-primary/10"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <span class="text-2xl" aria-hidden="true">{{ lang.flag }}</span>
                  <span class="min-w-0 text-start">
                    <span class="block break-words text-sm font-medium">{{ lang.nativeName }}</span>
                    <span class="block break-words text-xs text-text-secondary">{{ lang.name }}</span>
                  </span>
                </span>
                @if (currentLang() === lang.code) {
                  <span
                    class="ms-3 shrink-0 rounded-pill bg-primary/10 ps-2 pe-2 pt-0.5 pb-0.5 text-xs font-bold text-primary"
                    aria-hidden="true"
                  >
                    ✓ {{ 'common.selected' | t }}
                  </span>
                }
              </hlm-radio>
            }
          </hlm-radio-group>

          @if (isChanging()) {
            <p role="status" aria-live="polite" class="text-sm text-text-secondary">
              {{ 'common.loading' | t }}
            </p>
          }
        </section>
      </main>
    </div>
  `,
})
export class LanguageSettingsComponent {
  private readonly location = inject(Location);
  readonly i18n = inject(I18nService);

  readonly langs = this.i18n.availableLanguages;
  readonly currentLang = this.i18n.currentLang;
  readonly isChanging = signal(false);
  readonly hasError = signal(false);

  onLanguageValueChange(value: unknown): void {
    if (typeof value !== 'string') return;
    void this.selectLang(value);
  }

  async selectLang(code: string): Promise<void> {
    const nextLanguage = code.trim();
    if (
      this.isChanging() ||
      nextLanguage === this.currentLang() ||
      !this.langs.some((language) => language.code === nextLanguage)
    ) {
      return;
    }

    this.hasError.set(false);
    this.isChanging.set(true);
    try {
      await this.i18n.setLanguage(nextLanguage);
    } catch {
      this.hasError.set(true);
    } finally {
      this.isChanging.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
