import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-theme-selector',
  imports: [TranslatePipe],
  template: `
    <div
      role="radiogroup"
      [attr.aria-label]="'theme.label' | t"
      class="flex items-center gap-2 p-2 bg-surface-300 rounded-xl shadow-sm border border-surface-200"
    >
      <button
        (click)="setTheme('light')"
        [attr.aria-pressed]="currentTheme() === 'light'"
        [attr.aria-label]="'theme.light' | t"
        [class.bg-primary/15]="currentTheme() === 'light'"
        [class.text-primary]="currentTheme() === 'light'"
        class="ps-4 pe-4 py-2 text-sm font-medium rounded-lg text-text-secondary hover:bg-surface-200 transition-colors"
      >
        {{ 'theme.light' | t }}
      </button>
      <button
        (click)="setTheme('dark')"
        [attr.aria-pressed]="currentTheme() === 'dark'"
        [attr.aria-label]="'theme.dark' | t"
        [class.bg-primary/15]="currentTheme() === 'dark'"
        [class.text-primary]="currentTheme() === 'dark'"
        class="ps-4 pe-4 py-2 text-sm font-medium rounded-lg text-text-secondary hover:bg-surface-200 transition-colors"
      >
        {{ 'theme.dark' | t }}
      </button>
      <button
        (click)="setTheme('system')"
        [attr.aria-pressed]="currentTheme() === 'system'"
        [attr.aria-label]="'theme.system' | t"
        [class.bg-primary/15]="currentTheme() === 'system'"
        [class.text-primary]="currentTheme() === 'system'"
        class="ps-4 pe-4 py-2 text-sm font-medium rounded-lg text-text-secondary hover:bg-surface-200 transition-colors"
      >
        {{ 'theme.system' | t }}
      </button>
    </div>
  `,
})
export class ThemeSelectorComponent {
  private themeService = inject(ThemeService);

  currentTheme = this.themeService.currentTheme;

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }
}
