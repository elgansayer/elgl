import { Location } from '@angular/common';
import { ChangeDetectorRef, Component, inject, linkedSignal, signal } from '@angular/core';
import { disabled, form, FormField } from '@angular/forms/signals';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmRadio, HlmRadioGroup } from '@spartan-ng/helm/radio-group';
import { TranslatePipe } from '../../services/translate.pipe';
import { UiLanguagePreferenceService } from '../../services/ui-language-preference.service';

@Component({
  selector: 'app-language-settings',
  imports: [FormField, HlmButton, HlmRadio, HlmRadioGroup, TranslatePipe],
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
          <p
            role="alert"
            class="rounded-card border border-danger/30 bg-danger/10 p-3 text-sm text-danger-ink"
          >
            {{ 'languageSettings.loadError' | t }}
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
            [formField]="languageForm.language"
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
                    <span class="block break-words text-xs text-text-secondary">{{
                      lang.name
                    }}</span>
                  </span>
                </span>
                @if (currentLang() === lang.code) {
                  <span
                    class="ms-3 shrink-0 rounded-pill bg-primary/10 ps-2 pe-2 pt-0.5 pb-0.5 text-xs font-bold text-primary-ink"
                    aria-hidden="true"
                  >
                    ✓ {{ 'common.selected' | t }}
                  </span>
                }
              </hlm-radio>
            }
          </hlm-radio-group>

          <div role="status" aria-live="polite" class="text-sm text-text-secondary">
            @if (isChanging()) {
              {{ 'common.loading' | t }}
            } @else if (changedLanguageName(); as name) {
              {{ 'languageSettings.uiLangChanged' | t: { name } }}
            }
          </div>
        </section>
      </main>
    </div>
  `,
})
export class LanguageSettingsComponent {
  private readonly location = inject(Location);
  private readonly languagePreference = inject(UiLanguagePreferenceService);
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly langs = this.languagePreference.availableLanguages;
  readonly currentLang = this.languagePreference.currentLang;
  readonly isChanging = signal(false);
  readonly hasError = signal(false);
  /** Native name of the locale most recently applied, announced once via the status region. */
  readonly changedLanguageName = signal<string | null>(null);

  /**
   * The radio group keeps its own selection once a user clicks it and only
   * adopts a bound value that differs from the last one it saw. A rolled-back
   * switch lands on the value that was already bound, so the group would keep
   * showing the rejected locale and ignore a retry click on it. Owning the
   * selection as a form field lets this page call reset(), which re-writes the
   * control synchronously, to re-assert the active locale after every attempt.
   */
  private readonly selection = linkedSignal(() => ({ language: this.currentLang() }));
  readonly languageForm = form(this.selection, (path) => {
    disabled(path.language, () => this.isChanging());
  });

  onLanguageValueChange(value: unknown): void {
    if (typeof value !== 'string') return;
    void this.selectLang(value);
  }

  async selectLang(code: string): Promise<void> {
    if (this.isChanging()) return;

    const nextLanguage = code.trim();
    if (
      nextLanguage === this.currentLang() ||
      !this.langs.some((language) => language.code === nextLanguage)
    ) {
      this.showActiveLanguage();
      return;
    }

    this.hasError.set(false);
    this.changedLanguageName.set(null);
    this.isChanging.set(true);
    // Render the pending state before awaiting. The browser has already checked the clicked
    // radio, and Angular only rewrites a native input when its bound value changes between
    // renders. A rejection arriving within the same task would otherwise roll the selection
    // back before it was ever rendered, leaving the rejected locale visibly checked.
    this.changeDetector.detectChanges();
    try {
      await this.languagePreference.changeLanguage(nextLanguage);
      const applied = this.langs.find((language) => language.code === nextLanguage);
      this.changedLanguageName.set(applied?.nativeName ?? null);
    } catch {
      this.hasError.set(true);
    } finally {
      this.isChanging.set(false);
      this.showActiveLanguage();
    }
  }

  goBack(): void {
    this.location.back();
  }

  /** Makes the radio group reflect the locale that is actually active. */
  private showActiveLanguage(): void {
    this.languageForm.language().reset(this.currentLang());
  }
}
