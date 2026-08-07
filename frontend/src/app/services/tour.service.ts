import { Injectable, inject } from '@angular/core';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

/**
 * Manages interactive product tours using ngx-joyride.
 * The Virtual Coin Economy onboarding tour walks users through
 * the shop, coins, stickers, gifts, VIP, and cart flows.
 */
@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly joyrideService = inject(JoyrideService);
  private readonly i18n = inject(I18nService);

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
      customTexts: {
        prev: this.i18n.translate('tour.prev'),
        next: this.i18n.translate('tour.next'),
        done: this.i18n.translate('tour.done'),
        close: this.i18n.translate('tour.close'),
      },
    }).subscribe({
      error: () => {
        // Tour errors are non-critical; silently ignore
      },
    });
  }
}