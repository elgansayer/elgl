import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import type { UserProfile } from './user.service';

export type Theme = 'light' | 'dark' | 'system';

const ACCENT_STORAGE_KEY = 'app_primary_accent_color';
const THEME_STORAGE_KEY = 'app_theme';
const HEX_COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && ['light', 'dark', 'system'].includes(value);
}

function isAccentColour(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOUR_PATTERN.test(value);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  readonly currentTheme = signal<Theme>('system');
  /** null means no custom preference: the theme-aware Relay CSS default applies. */
  readonly primaryAccentColor = signal<string | null>(null);
  private document = inject(DOCUMENT);

  constructor() {
    this.initTheme();
    this.initAccent();

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
    if (typeof localStorage === 'undefined') return;

    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(savedTheme)) {
      this.currentTheme.set(savedTheme);
    }
  }

  private initAccent(): void {
    if (typeof localStorage === 'undefined') return;

    const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccentColour(savedAccent)) {
      this.primaryAccentColor.set(savedAccent);
      return;
    }

    if (savedAccent !== null) {
      localStorage.removeItem(ACCENT_STORAGE_KEY);
    }
  }

  setTheme(theme: Theme): void {
    this.currentTheme.set(theme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  }

  setPrimaryAccentColor(colour: string): void {
    if (!isAccentColour(colour)) {
      this.resetPrimaryAccentColor();
      return;
    }

    this.primaryAccentColor.set(colour);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACCENT_STORAGE_KEY, colour);
    }
  }

  resetPrimaryAccentColor(): void {
    this.primaryAccentColor.set(null);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ACCENT_STORAGE_KEY);
    }
  }

  loadFromProfile(profile: Partial<Pick<UserProfile, 'primary_accent_color'>> | null): void {
    const accent = profile?.primary_accent_color;
    if (isAccentColour(accent)) {
      this.setPrimaryAccentColor(accent);
      return;
    }

    this.resetPrimaryAccentColor();
  }

  private applyAccentColour(colour: string | null): void {
    if (typeof document === 'undefined') return;
    const root = this.document?.documentElement;
    if (!root) return;

    if (!colour) {
      root.style.removeProperty('--color-primary-rgb');
      root.style.removeProperty('--color-primary');
      return;
    }

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
