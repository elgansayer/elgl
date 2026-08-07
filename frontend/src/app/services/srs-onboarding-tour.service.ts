import { Injectable, inject, signal, PLATFORM_ID, DestroyRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

const SRS_TOUR_KEY = 'srs_onboarding_tour_completed';

@Injectable({ providedIn: 'root' })
export class SrsOnboardingTourService {
  private joyrideService = inject(JoyrideService);
  private i18n = inject(I18nService);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  readonly isTourInProgress = signal(false);
  readonly hasCompletedTour = signal(this.loadTourCompletionState());

  /** Tracks the active tour subscription for cleanup on service destruction. */
  private activeTourSubscription: { unsubscribe(): void } | null = null;

  private loadTourCompletionState(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;
    try {
      return localStorage.getItem(SRS_TOUR_KEY) === 'true';
    } catch {
      return false;
    }
  }

  startTour(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.isTourInProgress()) return;

    // Clean up any previous subscription before starting a new tour
    this.activeTourSubscription?.unsubscribe();
    this.isTourInProgress.set(true);

    const options = {
      steps: [
        'srsTourStep1DeckList',
        'srsTourStep2CreateDeck',
        'srsTourStep3Review',
      ],
      themeColor: '#6366f1',
      showCounter: true,
      showPrevButton: true,
      customTexts: {
        prev: this.i18n.translate('srsTour.prev') || 'Previous',
        next: this.i18n.translate('srsTour.next') || 'Next',
        done: this.i18n.translate('srsTour.done') || 'Got it!',
        close: this.i18n.translate('srsTour.close') || 'Skip',
      },
    };

    this.activeTourSubscription = this.joyrideService.startTour(options).subscribe({
      next: () => {
        // Tour step advanced
      },
      error: () => {
        this.isTourInProgress.set(false);
        this.activeTourSubscription = null;
      },
      complete: () => {
        this.isTourInProgress.set(false);
        this.markTourCompleted();
        this.activeTourSubscription = null;
      },
    });
  }

  closeTour(): void {
    this.activeTourSubscription?.unsubscribe();
    this.activeTourSubscription = null;
    this.joyrideService.closeTour();
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