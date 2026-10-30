import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';
import type { UserProfile } from './user.service';

export type Theme = 'light' | 'dark' | 'system';

const ACCENT_STORAGE_KEY = 'app_primary_accent_color';
const THEME_STORAGE_KEY = 'app_theme';
const HEX_COLOUR_PATTERN = /^#[0-9a-f]{6}$/i;
const MINIMUM_TEXT_CONTRAST = 4.5;
const LIGHTNESS_STEP = 0.005;
type RgbColour = [number, number, number];
type HslColour = [number, number, number];
const LIGHT_SURFACE_500: RgbColour = [246, 247, 250];

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && ['light', 'dark', 'system'].includes(value);
}

function isAccentColour(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOUR_PATTERN.test(value);
}

function hexToRgb(hex: string): RgbColour {
  const value = hex.slice(1);
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function rgbToHsl([redByte, greenByte, blueByte]: RgbColour): HslColour {
  const red = redByte / 255;
  const green = greenByte / 255;
  const blue = blueByte / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;

  if (delta === 0) return [0, 0, lightness];

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (maximum === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (maximum === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return [(hue + 360) % 360, saturation, lightness];
}

function hslToRgb([hue, saturation, lightness]: HslColour): RgbColour {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = second;
  } else if (hue < 120) {
    red = second;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = second;
  } else if (hue < 240) {
    green = second;
    blue = chroma;
  } else if (hue < 300) {
    red = second;
    blue = chroma;
  } else {
    red = chroma;
    blue = second;
  }

  return [
    Math.round((red + match) * 255),
    Math.round((green + match) * 255),
    Math.round((blue + match) * 255),
  ];
}

function relativeLuminance([red, green, blue]: RgbColour): number {
  const linearise = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * linearise(red) + 0.7152 * linearise(green) + 0.0722 * linearise(blue);
}

function contrastRatio(first: RgbColour, second: RgbColour): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function deriveLightTextColour(colour: RgbColour): RgbColour {
  const [hue, saturation, initialLightness] = rgbToHsl(colour);
  let lightness = initialLightness;
  let candidate = colour;

  while (contrastRatio(candidate, LIGHT_SURFACE_500) < MINIMUM_TEXT_CONTRAST && lightness > 0) {
    lightness = Math.max(0, lightness - LIGHTNESS_STEP);
    candidate = hslToRgb([hue, saturation, lightness]);
  }

  return candidate;
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

    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
        if (this.currentTheme() === 'system') {
          this.applyTheme(this.currentTheme());
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
    this.applyPrimaryTextColour([r, g, b], root.classList.contains('dark'));
  }

  private applyPrimaryTextColour(colour: RgbColour, isDark: boolean): void {
    const root = this.document?.documentElement;
    if (!root) return;

    const [red, green, blue] = isDark ? colour : deriveLightTextColour(colour);
    root.style.setProperty('--color-primary-text-rgb', `${red} ${green} ${blue}`);
  }

  private applyTheme(theme: Theme): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;

    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    this.document.documentElement.classList.toggle('dark', isDark);

    const accent = this.primaryAccentColor();
    if (accent) {
      this.applyPrimaryTextColour(hexToRgb(accent), isDark);
    }
  }
}
