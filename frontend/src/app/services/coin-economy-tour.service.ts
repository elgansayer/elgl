import { Injectable, inject } from '@angular/core';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';
import { Subscription } from 'rxjs';

const STEP_COINS_BALANCE = 'tourCoinsBalance';
const STEP_SHOP_NAV = 'tourShopNav';
const STEP_STICKER_NAV = 'tourStickerNav';
const STEP_VIP_NAV = 'tourVipNav';
const STEP_COINS_BUY = 'tourCoinsBuy';

/**
 * Manages the virtual coin economy product tour powered by ngx-joyride.
 * Provides a pre-configured tour with i18n step titles and descriptions.
 */
@Injectable({ providedIn: 'root' })
export class CoinEconomyTourService {
  private readonly joyrideService = inject(JoyrideService);
  private readonly i18n = inject(I18nService);

  private tourSubscription: Subscription | null = null;

  /**
   * Starts the coin economy product tour.
   * @returns true if the tour started, false if a tour is already in progress
   */
  startTour(): boolean {
    if (this.joyrideService.isTourInProgress()) {
      return false;
    }

    this.tourSubscription = this.joyrideService
      .startTour({
        steps: [
          STEP_COINS_BALANCE,
          STEP_SHOP_NAV,
          STEP_STICKER_NAV,
          STEP_VIP_NAV,
          STEP_COINS_BUY,
        ],
        themeColor: '#6366f1',
        showCounter: true,
        showPrevButton: true,
        customTexts: {
          prev: this.i18n.translate('common.back'),
          next: this.i18n.translate('common.next'),
          done: this.i18n.translate('common.finish'),
          close: this.i18n.translate('common.close'),
        },
      })
      .subscribe({
        next: (_stepInfo) => {
          // Step change event - can be used for analytics tracking
        },
        error: () => {
          this.tourSubscription = null;
        },
        complete: () => {
          this.tourSubscription = null;
        },
      });

    return true;
  }

  /**
   * Closes the tour if one is in progress.
   */
  closeTour(): void {
    this.joyrideService.closeTour();
    this.tourSubscription?.unsubscribe();
    this.tourSubscription = null;
  }

  /**
   * Returns whether a tour is currently in progress.
   */
  isTourInProgress(): boolean {
    return this.joyrideService.isTourInProgress();
  }
}
