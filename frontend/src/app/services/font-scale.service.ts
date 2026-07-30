import { Injectable, effect, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FontScaleService {
  readonly scaleFactor = signal<number>(1.0);

  private readonly storageKey = 'hellotalk_font_scale';

  constructor() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.0) {
        this.scaleFactor.set(parsed);
      }
    }

    effect(() => {
      const factor = this.scaleFactor();
      const basePx = 16 * factor;
      document.documentElement.style.fontSize = `${basePx}px`;
      localStorage.setItem(this.storageKey, factor.toString());
    });
  }

  setScale(factor: number): void {
    this.scaleFactor.set(factor);
  }
}
