import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-theme-selector',
  imports: [CommonModule],
  template: `
    <div
      class="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
    >
      <button
        (click)="setTheme('light')"
        [class.bg-blue-100]="currentTheme() === 'light'"
        [class.text-blue-700]="currentTheme() === 'light'"
        [class.dark:bg-blue-900]="currentTheme() === 'light'"
        [class.dark:text-blue-300]="currentTheme() === 'light'"
        class="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        Light
      </button>
      <button
        (click)="setTheme('dark')"
        [class.bg-blue-100]="currentTheme() === 'dark'"
        [class.text-blue-700]="currentTheme() === 'dark'"
        [class.dark:bg-blue-900]="currentTheme() === 'dark'"
        [class.dark:text-blue-300]="currentTheme() === 'dark'"
        class="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        Dark
      </button>
      <button
        (click)="setTheme('system')"
        [class.bg-blue-100]="currentTheme() === 'system'"
        [class.text-blue-700]="currentTheme() === 'system'"
        [class.dark:bg-blue-900]="currentTheme() === 'system'"
        [class.dark:text-blue-300]="currentTheme() === 'system'"
        class="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        System
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
