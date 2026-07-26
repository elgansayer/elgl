import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly currentTheme = signal<Theme>('system');

  constructor() {
    this.initTheme();

    effect(() => {
      this.applyTheme(this.currentTheme());
    });

    // Listen for system theme changes if 'system' is selected
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.currentTheme() === 'system') {
          this.applyTheme('system');
        }
      });
    }
  }

  private initTheme(): void {
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('app_theme') as Theme;
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        this.currentTheme.set(savedTheme);
      }
    }
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app_theme', theme);
    }
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const isDark = 
      theme === 'dark' || 
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
