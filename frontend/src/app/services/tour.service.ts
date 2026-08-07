import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

const VIDEO_CLASSROOM_TOUR_KEY = 'ht_video_classroom_tour_done';

/**
 * Manages interactive product tours using ngx-joyride.
 * The Virtual Coin Economy onboarding tour walks users through
 * the shop, coins, stickers, gifts, VIP, and cart flows.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly joyrideService = inject(JoyrideService);
  private readonly i18n = inject(I18nService);
  private readonly platformId = inject(PLATFORM_ID);

  /**
   * Steps for the Video Classroom onboarding tour.
   */
  readonly videoClassroomTourSteps = [
    'videoClassroomTour@marketplace',
    'videoClassroomTour@roomHeader',
    'videoClassroomTour@hostVideo',
    'videoClassroomTour@coHostInvite',
    'videoClassroomTour@liveChat',
  ];

  private get customTourTexts(): Record<string, string> {
    return {
      prev: this.i18n.translate('tour.prev'),
      next: this.i18n.translate('tour.next'),
      done: this.i18n.translate('tour.done'),
      close: this.i18n.translate('tour.close'),
    };
  }

  /**
   * Starts the Virtual Coin Economy onboarding tour.
   * Steps correspond to joyrideStep directive names placed on
   * economy-related components throughout the app.
   */
  startEconomyTour(): void {
    if (this.joyrideService.isTourInProgress()) {
      return;
    }

    this.joyrideService.startTour({
      steps: [
        'economyTour@coinsBalance',
        'economyTour@shopLink',
        'economyTour@stickerStore',
        'economyTour@vipLink',
        'economyTour@cartLink',
      ],
      stepDefaultPosition: 'bottom',
      themeColor: '#6366f1',
      showCounter: true,
      showPrevButton: true,
      customTexts: this.customTourTexts,
    }).subscribe({
      error: () => {
        // Tour errors are non-critical; silently ignore
      },
    });
  }

  /**
   * Starts the Video Classroom onboarding tour.
   * Highlights: marketplace browsing, room controls, host video,
   * co-host invite, and live chat overlay.
   */
  startVideoClassroomTour(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.joyrideService.isTourInProgress()) return;

    this.joyrideService.startTour({
      steps: this.videoClassroomTourSteps,
      stepDefaultPosition: 'bottom',
      themeColor: '#6366f1',
      showCounter: true,
      showPrevButton: true,
      customTexts: this.customTourTexts,
    }).subscribe({
      complete: () => {
        this.markVideoClassroomTourDone();
      },
      error: () => {
        // Tour errors are non-critical; silently ignore
      },
    });
  }

  /** Checks whether the user has already completed the Video Classroom tour. */
  isVideoClassroomTourDone(): boolean {
    if (!isPlatformBrowser(this.platformId)) return true;
    try {
      return localStorage.getItem(VIDEO_CLASSROOM_TOUR_KEY) === 'true';
    } catch {
      return false;
    }
  }

  /** Persist tour completion locally so it is only shown once. */
  markVideoClassroomTourDone(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(VIDEO_CLASSROOM_TOUR_KEY, 'true');
    } catch {
      // storage unavailable; ignore
    }
  }

  /** Reset the Video Classroom tour flag so it can be shown again. */
  resetVideoClassroomTour(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.removeItem(VIDEO_CLASSROOM_TOUR_KEY);
    } catch {
      // storage unavailable; ignore
    }
  }
}