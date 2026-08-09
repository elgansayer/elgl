import { Component, inject } from '@angular/core';
import { Theme, ThemeService } from '../../services/theme.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-appearance-settings',
  standalone: true,
  imports: [TranslatePipe, AppCardComponent],
  template: `
    <app-card variant="default" padding="lg">
      <h2 class="text-lg font-semibold mb-4">{{ 'appearance.title' | t }}</h2>

      <!-- Theme selection -->
      <div class="mb-6">
        <h3 class="text-sm text-content-muted mb-2">{{ 'appearance.themeLabel' | t }}</h3>
        <div class="flex gap-2">
          @for (opt of themeOptions; track opt) {
            <button
              (click)="setTheme(opt)"
              [class]="'px-4 py-2 rounded-lg transition-colors ' + (themeService.currentTheme() === opt ? 'bg-primary text-white' : 'bg-surface-100 text-content hover:bg-surface-200')"
            >
              {{ ('theme.' + opt) | t }}
            </button>
          }
        </div>
      </div>

      <!-- Language selection -->
      <div class="mb-2">
        <h3 class="text-sm text-content-muted mb-2">{{ 'appearance.languageLabel' | t }}</h3>
        <select
          [value]="i18nService.currentLang()"
          (change)="onLanguageChange($event)"
          class="w-full rounded-lg border border-surface-100 bg-surface-200 px-3 py-2 text-content focus:outline-none focus:ring-2 focus:ring-primary"
        >
          @for (lang of i18nService.availableLanguages; track lang.code) {
            <option [value]="lang.code">
              {{ lang.nativeName }} ({{ lang.flag }})
            </option>
          }
        </select>
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
    const value = target.value;
    if (value) {
      this.i18nService.setLanguage(value);
    }
  }
}
