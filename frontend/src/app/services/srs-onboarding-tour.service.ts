import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const SRS_TOUR_KEY = 'srs_onboarding_tour_completed';

@Injectable({ providedIn: 'root' })
export class SrsOnboardingTourService {
  private platformId = inject(PLATFORM_ID);

  readonly isTourInProgress = signal(false);
  readonly hasCompletedTour = signal(this.loadTourCompletionState());

  private loadTourCompletionState(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;
    try {
      return localStorage.getItem(SRS_TOUR_KEY) === 'true';
    } catch {
      return false;
    }
  }

  startTour(): void {
    // Tour disabled -- mark as complete immediately
    this.markTourCompleted();
  }

  closeTour(): void {
    this.isTourInProgress.set(false);
  }

  resetTour(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.removeItem(SRS_TOUR_KEY);
      this.hasCompletedTour.set(false);
    } catch {
      // ignore
    }
  }

  private markTourCompleted(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(SRS_TOUR_KEY, 'true');
      this.hasCompletedTour.set(true);
    } catch {
      // ignore
    }
  }
}