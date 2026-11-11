import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JoyrideService } from 'ngx-joyride';
import { firstValueFrom, lastValueFrom, timer } from 'rxjs';
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
/** Time for the vocabulary page to render its tour anchors once navigation has settled. */
const TOUR_ANCHOR_SETTLE_MS = 500;

@Injectable({ providedIn: 'root' })
export class SrsTourService {
  private readonly joyrideService = inject(JoyrideService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly hasCompletedTour = signal(this.checkTourCompleted());

  /** Set from the click until the tour ends, so a double click cannot queue a second tour. */
  private tourRequested = false;

  private checkTourCompleted(): boolean {
    try {
      return window.localStorage.getItem(SRS_TOUR_STORAGE_KEY) === 'true';
    } catch {
      return true;
    }
  }

  async startTour(): Promise<void> {
    if (this.tourRequested || this.joyrideService.isTourInProgress()) return;
    this.tourRequested = true;
    try {
      if (!(await this.openVocabularyPage())) return;
      await this.runTour();
      this.markTourCompleted();
    } finally {
      this.tourRequested = false;
    }
  }

  /** Navigates to the vocabulary page, then gives it time to render the tour anchors. */
  private async openVocabularyPage(): Promise<boolean> {
    try {
      await this.router.navigate(['/vocabulary']);
    } catch {
      return false;
    }
    await firstValueFrom(timer(TOUR_ANCHOR_SETTLE_MS));
    return true;
  }

  /** Resolves when the tour ends, and holds no subscription on joyride's step stream afterwards. */
  private async runTour(): Promise<void> {
    try {
      await lastValueFrom(this.joyrideService.startTour(this.tourOptions()), {
        defaultValue: undefined,
      });
    } catch {
      // The tour errors when a step anchor is missing; it still counts as seen.
    }
  }

  private tourOptions(): SrsTourOptions {
    const steps: string[] = [...SRS_TOUR_STEPS];
    return {
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