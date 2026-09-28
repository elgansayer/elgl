import { Injectable } from '@angular/core';

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'selection';

const HAPTIC_ENABLED_STORAGE_KEY = 'app_vibration_enabled';

function readStoredPreference(): boolean {
  if (typeof localStorage === 'undefined') return true;

  const stored = localStorage.getItem(HAPTIC_ENABLED_STORAGE_KEY);
  if (stored === null) return true;
  return stored === 'true';
}

@Injectable({
  providedIn: 'root',
})
export class HapticFeedbackService {
  private enabled = readStoredPreference();

  /**
   * Keep the local haptic preference in sync with the persisted user setting.
   * Existing users default to enabled until their server preference is loaded,
   * preserving the pre-preference behaviour while still making opt-out durable.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HAPTIC_ENABLED_STORAGE_KEY, String(enabled));
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Trigger haptic feedback using the Vibration API.
   * On devices that do not support it, or when vibration is disabled, the call
   * is silently ignored so feedback can never block the primary user action.
   */
  trigger(pattern: HapticIntensity = 'light'): void {
    if (!this.enabled || typeof navigator === 'undefined' || !navigator.vibrate) {
      return;
    }

    // Keep grading feedback semantically distinct: selection is a short
    // double-pulse success cue while medium/light are progressively gentler.
    const durationMap: Record<HapticIntensity, number | number[]> = {
      light: 10,
      medium: 20,
      heavy: 40,
      selection: [5, 10, 5],
    };

    const value = durationMap[pattern] ?? 10;
    try {
      navigator.vibrate(value);
    } catch {
      // Haptics are best-effort and must never prevent grading or other actions.
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
