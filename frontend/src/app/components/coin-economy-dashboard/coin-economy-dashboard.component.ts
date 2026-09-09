import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { EconomyStore, TransactionRecord } from '../../services/economy.store';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { CoinEconomyOnboardingService } from '../../services/coin-economy-onboarding.service';
import { AppCardComponent } from '../primitives/card/card.component';

@Component({
  selector: 'app-coin-economy-dashboard',
  standalone: true,
  imports: [HlmButton, TranslatePipe, RouterLink, DecimalPipe, AppCardComponent],
  template: `<div class="min-h-screen bg-surface-300 text-text-primary">
    <!-- Header with Coin Balance -->
    <section
      class="bg-gradient-to-br from-vip/20 via-surface-200 to-surface-300 ps-4 pe-4 pt-8 pb-12 md:ps-8 md:pe-8"
    >
      <div class="max-w-4xl mx-auto">
        <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 class="text-3xl md:text-4xl font-extrabold">{{ 'coinEconomy.title' | t }}</h1>
            <p class="text-text-secondary mt-1">{{ 'coinEconomy.subtitle' | t }}</p>
          </div>
          <button
            hlmBtn
            type="button"
            class="rounded-full bg-surface-200 border border-surface-100 px-4 py-2 text-sm font-medium hover:bg-surface-100 transition-colors"
            (click)="startTour()"
            [attr.aria-label]="'coinEconomy.restartTour' | t"
          >
            {{ 'coinEconomy.restartTour' | t }}
          </button>
        </div>

        <!-- Coin Balance Card -->
        <div
          class="rounded-3xl bg-gradient-to-br from-vip/20 to-vip/10 border border-vip/30 p-6 max-w-md"
        >
          <div class="flex items-center gap-4">
            <span class="text-4xl" aria-hidden="true">🪙</span>
            <div>
              <span class="text-xs font-bold uppercase text-text-secondary">{{
                'coinEconomy.balanceLabel' | t
              }}</span>
              <p class="text-3xl font-extrabold text-vip">{{ balance() | number }}</p>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              hlmBtn
              type="button"
              class="rounded-full bg-vip/20 px-4 py-2 text-sm font-semibold text-vip hover:bg-vip/30 transition-colors"
              (click)="claimDailyReward()"
            >
              {{ 'coinEconomy.dailyCheckIn' | t }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Quick Actions Grid -->
    <section class="ps-4 pe-4 pb-8 md:ps-8 md:pe-8">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-xl font-bold mb-4">{{ 'coinEconomy.quickActions' | t }}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Buy Coins -->
          <app-card variant="elevated" padding="md">
            <div class="flex flex-col items-center text-center gap-3">
              <span class="text-4xl" aria-hidden="true">💳</span>
              <h3 class="font-bold text-lg">{{ 'coinEconomy.buyCoins' | t }}</h3>
              <p class="text-sm text-text-secondary">{{ 'coinEconomy.buyCoinsDesc' | t }}</p>
              <a
                hlmBtn
                routerLink="/subscription"
                class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-fill hover:bg-primary/90 transition-colors inline-block"
              >
                {{ 'coinEconomy.buyCoinsBtn' | t }}
              </a>
            </div>
          </app-card>

          <!-- Send Gift -->
          <app-card variant="elevated" padding="md">
            <div class="flex flex-col items-center text-center gap-3">
              <span class="text-4xl" aria-hidden="true">🎁</span>
              <h3 class="font-bold text-lg">{{ 'coinEconomy.sendGift' | t }}</h3>
              <p class="text-sm text-text-secondary">{{ 'coinEconomy.sendGiftDesc' | t }}</p>
              <a
                hlmBtn
                routerLink="/chat"
                class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-fill hover:bg-primary/90 transition-colors inline-block"
              >
                {{ 'coinEconomy.sendGiftBtn' | t }}
              </a>
            </div>
          </app-card>

          <!-- Sticker Store -->
          <app-card variant="elevated" padding="md">
            <div class="flex flex-col items-center text-center gap-3">
              <span class="text-4xl" aria-hidden="true">🏷️</span>
              <h3 class="font-bold text-lg">{{ 'coinEconomy.stickerStore' | t }}</h3>
              <p class="text-sm text-text-secondary">{{ 'coinEconomy.stickerStoreDesc' | t }}</p>
              <a
                hlmBtn
                routerLink="/sticker-store"
                class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-fill hover:bg-primary/90 transition-colors inline-block"
              >
                {{ 'coinEconomy.stickerStoreBtn' | t }}
              </a>
            </div>
          </app-card>

          <!-- Shop -->
          <app-card variant="elevated" padding="md">
            <div class="flex flex-col items-center text-center gap-3">
              <span class="text-4xl" aria-hidden="true">🛍️</span>
              <h3 class="font-bold text-lg">{{ 'coinEconomy.shop' | t }}</h3>
              <p class="text-sm text-text-secondary">{{ 'coinEconomy.shopDesc' | t }}</p>
              <a
                hlmBtn
                routerLink="/shop"
                class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-fill hover:bg-primary/90 transition-colors inline-block"
              >
                {{ 'coinEconomy.shopBtn' | t }}
              </a>
            </div>
          </app-card>

          <!-- VIP Subscription -->
          <app-card variant="elevated" padding="md">
            <div class="flex flex-col items-center text-center gap-3">
              <span class="text-4xl" aria-hidden="true">👑</span>
              <h3 class="font-bold text-lg">{{ 'coinEconomy.vip' | t }}</h3>
              <p class="text-sm text-text-secondary">{{ 'coinEconomy.vipDesc' | t }}</p>
              <a
                hlmBtn
                routerLink="/subscription"
                class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-fill hover:bg-primary/90 transition-colors inline-block"
              >
                {{ 'coinEconomy.vipBtn' | t }}
              </a>
            </div>
          </app-card>

          <!-- Escrow Payments -->
          <app-card variant="elevated" padding="md">
            <div class="flex flex-col items-center text-center gap-3">
              <span class="text-4xl" aria-hidden="true">🔒</span>
              <h3 class="font-bold text-lg">{{ 'coinEconomy.escrowPayments' | t }}</h3>
              <p class="text-sm text-text-secondary">{{ 'coinEconomy.escrowPaymentsDesc' | t }}</p>
              <a
                hlmBtn
                routerLink="/escrow"
                class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-fill hover:bg-primary/90 transition-colors inline-block"
              >
                {{ 'coinEconomy.escrowPaymentsBtn' | t }}
              </a>
            </div>
          </app-card>
        </div>
      </div>
    </section>

    <!-- Recent Activity -->
    <section class="ps-4 pe-4 pb-12 md:ps-8 md:pe-8">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-xl font-bold mb-4">{{ 'coinEconomy.recentActivity' | t }}</h2>
        <app-card variant="outlined" padding="md">
          <div class="space-y-3">
            <!-- Gift Catalog Preview -->
            @if (economyStore.catalog().length > 0) {
              <div>
                <h3 class="text-sm font-semibold text-text-secondary uppercase mb-2">
                  {{ 'coinEconomy.popularGifts' | t }}
                </h3>
                <div class="flex flex-wrap gap-3">
                  @for (gift of economyStore.catalog().slice(0, 5); track gift.id) {
                    <div
                      class="flex items-center gap-2 rounded-full bg-surface-200 px-3 py-1.5 text-sm"
                    >
                      <span>{{ gift.icon }}</span>
                      <span class="font-medium">{{ gift.name }}</span>
                      <span class="text-vip font-semibold">{{ gift.cost_coins }}</span>
                    </div>
                  }
                </div>
              </div>
            }
            <!-- Sticker Packs Preview -->
            @if (economyStore.stickerPacks().length > 0) {
              <div>
                <h3 class="text-sm font-semibold text-text-secondary uppercase mb-2">
                  {{ 'coinEconomy.yourStickerPacks' | t }}
                </h3>
                <div class="flex flex-wrap gap-2">
                  @for (pack of economyStore.stickerPacks().slice(0, 5); track pack.id) {
                    <span
                      class="rounded-full px-3 py-1 text-xs font-medium"
                      [class.bg-success/20]="pack.owned"
                      [class.text-success]="pack.owned"
                      [class.bg-surface-200]="!pack.owned"
                      [class.text-text-secondary]="!pack.owned"
                    >
                      {{ pack.name }} {{ pack.owned ? '✓' : pack.cost_coins + ' 🪙' }}
                    </span>
                  }
                </div>
              </div>
            }
            @if (economyStore.catalog().length === 0 && economyStore.stickerPacks().length === 0) {
              <p class="text-text-secondary text-sm">{{ 'coinEconomy.loadingData' | t }}</p>
            }
          </div>
        </app-card>
      </div>
    </section>
  </div>`,
})
export class CoinEconomyDashboardComponent implements AfterViewInit {
  readonly economyStore = inject(EconomyStore);
  private readonly i18n = inject(I18nService);
  private readonly onboardingService = inject(CoinEconomyOnboardingService);

  readonly balance = this.economyStore.coinsBalance;

  ngAfterViewInit(): void {
    void this.economyStore.loadInitialData();
    this.maybeStartTour();
  }

  getTransactionTypeLabel(type: TransactionRecord['type']): string {
    return this.i18n.translate(`coinEconomy.transaction.${type}`);
  }

  private maybeStartTour(): void {
    if (this.onboardingService.isCompleted()) {
      return;
    }
    // Tour display requires a DOM element; mark as complete if not available
    this.onboardingService.markComplete();
  }

  async claimDailyReward(): Promise<void> {
    await this.economyStore.claimDailyCheckIn();
  }

  startTour(): void {
    this.onboardingService.reset();
    this.maybeStartTour();
  }
}
