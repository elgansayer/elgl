import { Injectable, signal } from '@angular/core';

export interface CoinEconomyOnboardingStep {
  key: string;
  title: string;
  text: string;
}

/**
 * Manages the onboarding tour state for the Virtual Coin Economy feature.
 * Steps correspond to `joyrideStep` directive names in the template.
 */
@Injectable({ providedIn: 'root' })
export class CoinEconomyOnboardingService {
  private readonly storageKey = 'hellotalk_coin_economy_onboarding_done';

  /** Whether the coin economy onboarding tour has been completed this session. */
  readonly isTourInProgress = signal(false);

  /** Step names registered with the onboarding tour component in the template. */
  readonly steps: CoinEconomyOnboardingStep[] = [
    {
      key: 'coinEconomyStepBalance',
      title: 'Coin Balance',
      text: 'Your virtual coin balance is shown here. Earn coins through daily check-ins, quests, and purchases.',
    },
    {
      key: 'coinEconomyStepBuyCoins',
      title: 'Buy Coins',
      text: 'Purchase coin packages here to unlock gifts, stickers, and premium features.',
    },
    {
      key: 'coinEconomyStepSendGift',
      title: 'Send Virtual Gifts',
      text: 'Browse and send animated virtual gifts to your language partners to show appreciation.',
    },
    {
      key: 'coinEconomyStepStickerStore',
      title: 'Sticker Store',
      text: 'Browse and unlock sticker packs with your coins. Use them in chats and moments.',
    },
    {
      key: 'coinEconomyStepShop',
      title: 'Shop',
      text: 'Visit the shop to spend coins on exclusive items and virtual goods.',
    },
    {
      key: 'coinEconomyStepVIP',
      title: 'VIP Subscription',
      text: 'Upgrade to VIP for premium features including incognito visits, developer API access, and exclusive content.',
    },
  ];

  get stepNames(): string[] {
    return this.steps.map((s) => s.key);
  }

  markComplete(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.setItem(this.storageKey, 'true');
    } catch {
      // storage unavailable, ignore
    }
  }

  isCompleted(): boolean {
    try {
      return window.localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }

  /** Reset onboarding flag - useful for testing or re-enabling tours. */
  reset(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.removeItem(this.storageKey);
    } catch {
      // storage unavailable, ignore
    }
  }
}