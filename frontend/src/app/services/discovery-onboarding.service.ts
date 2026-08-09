import { Injectable, signal } from '@angular/core';

/**
 * Manages the onboarding tour state for the Discovery feature.
 * Joyride-based tours have been removed; this service is retained as a compat shim.
 */
@Injectable({ providedIn: 'root' })
export class DiscoveryOnboardingService {
  private readonly storageKey = 'hellotalk_discovery_onboarding_done';

  readonly isTourInProgress = signal(false);

  startTour(): void {
    this.markComplete();
  }

  markComplete(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.setItem(this.storageKey, 'true');
    } catch {
      // storage unavailable, ignore
    }
  }

  hasCompletedTour(): boolean {
    try {
      return window.localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }

  isCompleted(): boolean {
    return this.hasCompletedTour();
  }

  resetTour(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.removeItem(this.storageKey);
    } catch {
      // storage unavailable, ignore
    }
  }
}
