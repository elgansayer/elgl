import { Component, inject } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslatePipe } from '../../services/translate.pipe';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-theme-selector',
  imports: [TranslatePipe, ...HlmButtonImports],
  template: `
    <div
      role="radiogroup"
      [attr.aria-label]="'theme.label' | t"
      class="flex items-center gap-2 rounded-xl border border-surface-200 bg-surface-300 p-2 shadow-sm"
    >
      @for (theme of themes; track theme.value) {
        <button
          hlmBtn
          type="button"
          variant="ghost"
          size="sm"
          role="radio"
          [attr.aria-checked]="currentTheme() === theme.value"
          [attr.aria-label]="theme.label | t"
          [class.bg-primary/15]="currentTheme() === theme.value"
          [class.text-primary]="currentTheme() === theme.value"
          (click)="setTheme(theme.value)"
        >
          {{ theme.label | t }}
        </button>
      }
    </div>
  `,
})
export class ThemeSelectorComponent {
  private themeService = inject(ThemeService);

  readonly currentTheme = this.themeService.currentTheme;
  readonly themes: ReadonlyArray<{ value: Theme; label: string }> = [
    { value: 'light', label: 'theme.light' },
    { value: 'dark', label: 'theme.dark' },
    { value: 'system', label: 'theme.system' },
  ];

  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }
}
