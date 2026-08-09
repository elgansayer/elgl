import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import type { UserProfile } from './user.service';

export type Theme = 'light' | 'dark' | 'system';

const DEFAULT_ACCENT = '#4f46e5';

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && ['light', 'dark', 'system'].includes(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ];
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly currentTheme = signal<Theme>('system');
  readonly primaryAccentColor = signal<string>(DEFAULT_ACCENT);
  private document = inject(DOCUMENT);

  constructor() {
    this.initTheme();

    this.applyTheme(this.currentTheme());
    this.applyAccentColour(this.primaryAccentColor());

    effect(() => {
      this.applyTheme(this.currentTheme());
    });

    effect(() => {
      this.applyAccentColour(this.primaryAccentColor());
    });

    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.currentTheme() === 'system') {
          this.applyTheme(this.currentTheme());
        }
      });
    }
  }

  private initTheme(): void {
    if (typeof localStorage !== 'undefined') {
      const savedTheme = localStorage.getItem('app_theme');
      if (isTheme(savedTheme)) {
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

  setPrimaryAccentColor(colour: string): void {
    this.primaryAccentColor.set(colour);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app_primary_accent_color', colour);
    }
  }

  loadFromProfile(profile: Partial<Pick<UserProfile, 'primary_accent_color'>> | null): void {
    const colour = profile?.primary_accent_color ?? DEFAULT_ACCENT;
    this.setPrimaryAccentColor(colour);
  }

  private applyAccentColour(colour: string): void {
    if (typeof document === 'undefined') return;
    const root = this.document?.documentElement;
    if (!root) return;

    const [r, g, b] = hexToRgb(colour);
    root.style.setProperty('--color-primary-rgb', `${r} ${g} ${b}`);
    root.style.setProperty('--color-primary', colour);
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    this.document.documentElement.classList.toggle('dark', isDark);
  }
}
