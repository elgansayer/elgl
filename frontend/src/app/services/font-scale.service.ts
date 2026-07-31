import { Injectable, inject, signal, effect } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type FontScale = number;

const DEFAULT_SCALE = 1.0;
const MIN_SCALE = 0.8;
const MAX_SCALE = 1.2;
const STEP = 0.05;
const STORAGE_KEY = 'app_font_scale';

function isScale(value: unknown): value is FontScale {
  return typeof value === 'number' && value >= MIN_SCALE && value <= MAX_SCALE;
}

@Injectable({
  providedIn: 'root',
})
export class FontScaleService {
  readonly scaleFactor = signal<FontScale>(this.loadInitialScale());
  readonly min = MIN_SCALE;
  readonly max = MAX_SCALE;
  readonly step = STEP;

  private document = inject(DOCUMENT);

  constructor() {
    this.applyScale(this.scaleFactor());

    effect(() => {
      const scale = this.scaleFactor();
      this.applyScale(scale);
      this.saveToStorage(scale);
    });
  }

  setScale(next: number): void {
    const stepCount = Math.round((next - MIN_SCALE) / STEP);
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, MIN_SCALE + stepCount * STEP));
    this.scaleFactor.set(clamped);
    this.applyScale(clamped);
    this.saveToStorage(clamped);
  }

  reset(): void {
    this.setScale(DEFAULT_SCALE);
  }

  private loadInitialScale(): FontScale {
    if (typeof localStorage === 'undefined') return DEFAULT_SCALE;
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw !== null ? Number.parseFloat(raw) : Number.NaN;
    if (isScale(parsed)) return parsed;
    if (!Number.isNaN(parsed) && parsed >= 80 && parsed <= 120) {
      return parsed / 100;
    }
    return DEFAULT_SCALE;
  }

  private saveToStorage(scale: FontScale): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, String(Math.round(scale * 100)));
    }
  }

  private applyScale(scale: FontScale): void {
    if (!this.document) return;
    const root = this.document.documentElement;
    if (!root) return;
    const baseRem = 16 * scale;
    root.style.fontSize = `${baseRem}px`;
    root.style.setProperty('--app-base-font-size', `${baseRem}px`);
  }
}
