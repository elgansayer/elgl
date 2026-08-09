import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

export const SRS_TOUR_STEPS = [
  'srsTourVocabularyDashboard',
  'srsTourFlashcardDecks',
  'srsTourFlashcardReview',
] as const;

export type SrsTourStepName = (typeof SRS_TOUR_STEPS)[number];

interface SrsTourOptions {
  steps: string[];
  startWith?: string;
  waitingTime?: number;
  stepDefaultPosition?: string;
  themeColor?: string;
  showCounter?: boolean;
  showPrevButton?: boolean;
  customTexts?: {
    prev?: string;
    next?: string;
    done?: string;
    close?: string;
  };
}

const SRS_TOUR_STORAGE_KEY = 'hellotalk_srs_tour_completed';

@Injectable({ providedIn: 'root' })
export class SrsTourService {
  private readonly joyrideService = inject(JoyrideService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly hasCompletedTour = signal(this.checkTourCompleted());

  private checkTourCompleted(): boolean {
    try {
      return window.localStorage.getItem(SRS_TOUR_STORAGE_KEY) === 'true';
    } catch {
      return true;
    }
  }

  startTour(): void {
    const steps: string[] = [...SRS_TOUR_STEPS];

    const options: SrsTourOptions = {
      steps,
      startWith: steps[0],
      stepDefaultPosition: 'bottom',
      themeColor: '#6366f1',
      showCounter: true,
      showPrevButton: true,
      waitingTime: 200,
      customTexts: {
        prev: this.i18n.translate('srsTour.prevBtn'),
        next: this.i18n.translate('srsTour.nextBtn'),
        done: this.i18n.translate('srsTour.doneBtn'),
        close: this.i18n.translate('srsTour.closeBtn'),
      },
    };

    // Navigate to vocabulary page first
    this.router.navigate(['/vocabulary']).then(() => {
      setTimeout(() => {
        this.joyrideService.startTour(options).subscribe({
          complete: () => this.markTourCompleted(),
          error: () => {
            // Tour may error if steps aren't all found - still mark as seen
            this.markTourCompleted();
          },
        });
      }, 500);
    });
  }

  private markTourCompleted(): void {
    this.hasCompletedTour.set(true);
    try {
      window.localStorage.setItem(SRS_TOUR_STORAGE_KEY, 'true');
    } catch {
      // Silently ignore
    }
  }
}