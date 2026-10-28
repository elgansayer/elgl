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

const SURFACE_500_LIGHT: [number, number, number] = [246, 247, 250];

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const val = Math.round(l * 255);
    return [val, val, val];
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

export function deriveTextRole(r: number, g: number, b: number): [number, number, number] {
  if (contrastRatio([r, g, b], SURFACE_500_LIGHT) >= 4.5) {
    return [r, g, b];
  }
  const [h, s, initialL] = rgbToHsl(r, g, b);
  let l = initialL;
  while (l > 0) {
    l = Math.max(0, l - 0.01);
    const candidate = hslToRgb(h, s, l);
    if (contrastRatio(candidate, SURFACE_500_LIGHT) >= 4.5) {
      return candidate;
    }
  }
  return [0, 0, 0];
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
      this.applyAccentColour(this.primaryAccentColor());
    });

    effect(() => {
      this.applyAccentColour(this.primaryAccentColor());
    });

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (this.currentTheme() === 'system') {
          this.applyTheme(this.currentTheme());
          this.applyAccentColour(this.primaryAccentColor());
        }
      });
    }
  }

  private initTheme(): void {
    try {
      if (typeof localStorage === 'undefined') return;

      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (isTheme(savedTheme)) {
        this.currentTheme.set(savedTheme);
      } else if (savedTheme !== null) {
        localStorage.removeItem(THEME_STORAGE_KEY);
      }
    } catch {
      // Keep the system default when storage is disabled by browser privacy settings.
    }
  }

  private initAccent(): void {
    try {
      if (typeof localStorage === 'undefined') return;

      const savedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (isAccentColour(savedAccent)) {
        this.primaryAccentColor.set(savedAccent);
        return;
      }

      if (savedAccent !== null) {
        localStorage.removeItem(ACCENT_STORAGE_KEY);
      }
    } catch {
      // Keep the theme-aware Relay default when storage is unavailable.
    }
  }

  setTheme(theme: Theme): void {
    if (!isTheme(theme)) return;
    this.currentTheme.set(theme);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
    } catch {
      // The in-memory theme remains usable when storage is blocked or full.
    }
  }

  setPrimaryAccentColor(colour: string): void {
    if (!isAccentColour(colour)) {
      this.resetPrimaryAccentColor();
      return;
    }

    this.primaryAccentColor.set(colour);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(ACCENT_STORAGE_KEY, colour);
      }
    } catch {
      // The in-memory accent remains usable when storage is blocked or full.
    }
  }

  resetPrimaryAccentColor(): void {
    this.primaryAccentColor.set(null);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(ACCENT_STORAGE_KEY);
      }
    } catch {
      // Clearing the active CSS variables is authoritative even if storage cannot be updated.
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
      root.style.removeProperty('--color-primary-text-rgb');
      return;
    }

    const [r, g, b] = hexToRgb(colour);
    root.style.setProperty('--color-primary-rgb', `${r} ${g} ${b}`);
    root.style.setProperty('--color-primary', colour);

    const isDark = root.classList.contains('dark');
    if (isDark) {
      root.style.setProperty('--color-primary-text-rgb', `${r} ${g} ${b}`);
    } else {
      const [tr, tg, tb] = deriveTextRole(r, g, b);
      root.style.setProperty('--color-primary-text-rgb', `${tr} ${tg} ${tb}`);
    }
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    this.document.documentElement.classList.toggle('dark', isDark);
  }
}
