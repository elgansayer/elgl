import { Injectable } from '@angular/core';

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'selection';

@Injectable({
  providedIn: 'root',
})
export class HapticFeedbackService {
  /**
   * Trigger haptic feedback using the Vibration API.
   * On devices that do not support it, the call is silently ignored.
   */
  trigger(pattern: HapticIntensity = 'light'): void {
    if (typeof navigator === 'undefined' || !navigator.vibrate) {
      return;
    }

    // Map human-readable pattern to a vibration duration (ms) or pattern array
    const durationMap: Record<HapticIntensity, number | number[]> = {
      light: 10,
      medium: 20,
      heavy: 40,
      selection: [5, 10, 5], // like a double tap
    };

    const value = durationMap[pattern] ?? 10;
    try {
      navigator.vibrate(value);
    } catch {
      // silently fail in environments where the API throws
    }
  }

  /** Convenience for a strong tap (like sending a message) */
  tap(): void {
    this.trigger('light');
  }

  /** Convenience for a short success (like liking a post) */
  success(): void {
    this.trigger('selection');
  }
}
