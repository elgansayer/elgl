import { HlmNativeSelect } from '@spartan-ng/helm/native-select';
import { Component, inject } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { Theme, ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [HlmNativeSelect, TranslatePipe, AppCardComponent, ...HlmButtonImports],
  template: `
    <app-card variant="default" padding="lg">
      <h2 class="mb-4 text-lg font-semibold">{{ 'appearance.title' | t }}</h2>

      <div class="mb-6">
        <h3 class="mb-2 text-sm text-content-muted">{{ 'appearance.themeLabel' | t }}</h3>
        <div class="flex gap-2" role="radiogroup">
          @for (opt of themeOptions; track opt) {
            <button
              hlmBtn
              type="button"
              variant="secondary"
              size="sm"
              role="radio"
              [attr.aria-checked]="themeService.currentTheme() === opt"
              [class.bg-primary]="themeService.currentTheme() === opt"
              [class.text-on-fill]="themeService.currentTheme() === opt"
              (click)="setTheme(opt)"
            >
              {{ ('theme.' + opt) | t }}
            </button>
          }
        </div>
      </div>

      <div class="mb-2">
        <h3 class="mb-2 text-sm text-content-muted">{{ 'appearance.languageLabel' | t }}</h3>
        <hlm-native-select
          [value]="i18nService.currentLang()"
          (change)="onLanguageChange($event)"
          class="w-full rounded-lg border border-surface-100 bg-surface-200 px-3 py-2 text-content" selectClass="w-full rounded-lg border border-surface-100 bg-surface-200 px-3 py-2 text-content"
        >
          @for (lang of i18nService.availableLanguages; track lang.code) {
            <option [value]="lang.code">{{ lang.nativeName }} ({{ lang.flag }})</option>
          }
        </hlm-native-select>
      </div>
    </app-card>
  `,
})
export class AppearanceSettingsComponent {
  readonly themeService = inject(ThemeService);
  readonly i18nService = inject(I18nService);
  readonly themeOptions: Theme[] = ['light', 'dark', 'system'];

  setTheme(opt: Theme): void {
    this.themeService.setTheme(opt);
  }

  onLanguageChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    if (target.value) this.i18nService.setLanguage(target.value);
  }
}
