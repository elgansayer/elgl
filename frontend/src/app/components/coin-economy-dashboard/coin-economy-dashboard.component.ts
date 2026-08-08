import { Component, inject, AfterViewInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { EconomyStore, TransactionRecord, PremiumAiService } from '../../services/economy.store';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { CoinEconomyOnboardingService } from '../../services/coin-economy-onboarding.service';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppPillComponent } from '../primitives/pill/pill.component';
import { AppButtonPrimaryComponent } from '../primitives/button-primary/button-primary.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-coin-economy-dashboard',
  standalone: true,
  imports: [
    TranslatePipe,
    RouterLink,
    DecimalPipe,
    FormsModule,
    AppCardComponent,
    AppPillComponent,
    AppButtonPrimaryComponent,
    AppSkeletonLoaderComponent,
    AppEmptyStateComponent,
  ],
  template: `<div class="min-h-screen bg-surface-300 text-text-primary">
  <!-- Header with Coin Balance -->
  <section class="bg-gradient-to-br from-indigo-900/40 via-surface-200 to-surface-300 ps-4 pe-4 pt-8 pb-12 md:ps-8 md:pe-8">
    <div class="max-w-4xl mx-auto">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="text-3xl md:text-4xl font-extrabold">{{ 'coinEconomy.title' | t }}</h1>
          <p class="text-text-secondary mt-1">{{ 'coinEconomy.subtitle' | t }}</p>
        </div>
        <button
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
        
        class="rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 p-6 max-w-md"
      >
        <div class="flex items-center gap-4">
          <span class="text-4xl" aria-hidden="true">🪙</span>
          <div>
            <span class="text-xs font-bold uppercase text-text-secondary">{{ 'coinEconomy.balanceLabel' | t }}</span>
            <p class="text-3xl font-extrabold text-amber-400">{{ balance() | number }}</p>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/30 transition-colors"
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
          <div  class="flex flex-col items-center text-center gap-3">
            <span class="text-4xl" aria-hidden="true">💳</span>
            <h3 class="font-bold text-lg">{{ 'coinEconomy.buyCoins' | t }}</h3>
            <p class="text-sm text-text-secondary">{{ 'coinEconomy.buyCoinsDesc' | t }}</p>
            <a
              routerLink="/vip"
              class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors inline-block"
            >
              {{ 'coinEconomy.buyCoinsBtn' | t }}
            </a>
          </div>
        </app-card>

        <!-- Send Gift -->
        <app-card variant="elevated" padding="md">
          <div  class="flex flex-col items-center text-center gap-3">
            <span class="text-4xl" aria-hidden="true">🎁</span>
            <h3 class="font-bold text-lg">{{ 'coinEconomy.sendGift' | t }}</h3>
            <p class="text-sm text-text-secondary">{{ 'coinEconomy.sendGiftDesc' | t }}</p>
            <a
              routerLink="/chat"
              class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors inline-block"
            >
              {{ 'coinEconomy.sendGiftBtn' | t }}
            </a>
          </div>
        </app-card>

        <!-- Sticker Store -->
        <app-card variant="elevated" padding="md">
          <div  class="flex flex-col items-center text-center gap-3">
            <span class="text-4xl" aria-hidden="true">🏷️</span>
            <h3 class="font-bold text-lg">{{ 'coinEconomy.stickerStore' | t }}</h3>
            <p class="text-sm text-text-secondary">{{ 'coinEconomy.stickerStoreDesc' | t }}</p>
            <a
              routerLink="/sticker-store"
              class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors inline-block"
            >
              {{ 'coinEconomy.stickerStoreBtn' | t }}
            </a>
          </div>
        </app-card>

        <!-- Shop -->
        <app-card variant="elevated" padding="md">
          <div  class="flex flex-col items-center text-center gap-3">
            <span class="text-4xl" aria-hidden="true">🛍️</span>
            <h3 class="font-bold text-lg">{{ 'coinEconomy.shop' | t }}</h3>
            <p class="text-sm text-text-secondary">{{ 'coinEconomy.shopDesc' | t }}</p>
            <a
              routerLink="/shop"
              class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors inline-block"
            >
              {{ 'coinEconomy.shopBtn' | t }}
            </a>
          </div>
        </app-card>

        <!-- VIP Subscription -->
        <app-card variant="elevated" padding="md">
          <div  class="flex flex-col items-center text-center gap-3">
            <span class="text-4xl" aria-hidden="true">👑</span>
            <h3 class="font-bold text-lg">{{ 'coinEconomy.vip' | t }}</h3>
            <p class="text-sm text-text-secondary">{{ 'coinEconomy.vipDesc' | t }}</p>
            <a
              routerLink="/vip"
              class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors inline-block"
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
              routerLink="/escrow"
              class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors inline-block"
            >
              {{ 'coinEconomy.escrowPaymentsBtn' | t }}
            </a>
          </div>
        </app-card>

        <!-- Premium AI Services -->
        @if (economyStore.premiumServices().length > 0) {
          @for (svc of economyStore.premiumServices(); track svc.id) {
            <app-card variant="elevated" padding="md">
              <div class="flex flex-col items-center text-center gap-3">
                <span class="text-4xl" aria-hidden="true">{{ svc.icon }}</span>
                <h3 class="font-bold text-lg">{{ svc.name }}</h3>
                <p class="text-sm text-text-secondary">{{ svc.description }}</p>
                <span class="text-sm font-semibold text-amber-400">
                  {{ 'coinEconomy.unlockReportCost' | t: { coins: svc.cost_coins } }}
                </span>
                <input
                  type="text"
                  class="w-full bg-surface-200 text-white rounded-lg px-3 py-2 text-sm placeholder-neutral-400 border border-surface-100 focus:border-primary outline-none"
                  [placeholder]="'Enter partner ID'"
                  [ngModel]="partnerIdInput"
                  (ngModelChange)="partnerIdInput = $event"
                />
                <button
                  type="button"
                  class="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-40"
                  [disabled]="economyStore.unlockReportLoading() || economyStore.coinsBalance() < svc.cost_coins || !partnerIdInput.trim()"
                  (click)="openUnlockDialog(svc)"
                >
                  {{ 'coinEconomy.unlockReport' | t }}
                </button>
              </div>
            </app-card>
          }
        }
      </div>
    </div>
  </section>

  <!-- Analysis Report Section -->
  @if (economyStore.unlockReport(); as report) {
    <section class="ps-4 pe-4 pb-8 md:ps-8 md:pe-8">
      <div class="max-w-4xl mx-auto">
        <app-card variant="elevated" padding="md" >
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <span class="text-3xl" aria-hidden="true">📊</span>
              <div>
                <h2 class="text-xl font-bold">
                  {{ 'coinEconomy.conversationAnalysisReport.reportTitle' | t: { name: report.partner_name } }}
                </h2>
                <p class="text-sm text-text-secondary">{{ 'coinEconomy.conversationAnalysisReport.desc' | t }}</p>
              </div>
            </div>

            <!-- Key metrics -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div class="bg-surface-200 rounded-xl p-3 text-center">
                <p class="text-xs text-text-secondary">{{ 'coinEconomy.report.totalMessages' | t }}</p>
                <p class="text-2xl font-extrabold text-amber-400">{{ report.total_messages }}</p>
              </div>
              <div class="bg-surface-200 rounded-xl p-3 text-center">
                <p class="text-xs text-text-secondary">{{ 'coinEconomy.report.messagesByUser' | t }}</p>
                <p class="text-2xl font-extrabold text-emerald-400">{{ report.messages_by_user }}</p>
              </div>
              <div class="bg-surface-200 rounded-xl p-3 text-center">
                <p class="text-xs text-text-secondary">{{ 'coinEconomy.report.messagesByPartner' | t }}</p>
                <p class="text-2xl font-extrabold text-blue-400">{{ report.messages_by_partner }}</p>
              </div>
              <div class="bg-surface-200 rounded-xl p-3 text-center">
                <p class="text-xs text-text-secondary">{{ 'coinEconomy.report.engagementScore' | t }}</p>
                <p class="text-2xl font-extrabold" [class.text-rose-400]="report.engagement_score < 40" [class.text-amber-400]="report.engagement_score >= 40 && report.engagement_score < 70" [class.text-emerald-400]="report.engagement_score >= 70">{{ report.engagement_score }}%</p>
              </div>
            </div>

            <!-- Additional stats -->
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div class="bg-surface-200 rounded-xl p-3">
                <p class="text-xs text-text-secondary">{{ 'coinEconomy.report.daysSinceFirst' | t }}</p>
                <p class="text-lg font-semibold">{{ report.days_since_first_contact }}</p>
              </div>
              <div class="bg-surface-200 rounded-xl p-3">
                <p class="text-xs text-text-secondary">{{ 'coinEconomy.report.avgPerDay' | t }}</p>
                <p class="text-lg font-semibold">{{ report.average_messages_per_day }}</p>
              </div>
              <div class="bg-surface-200 rounded-xl p-3">
                <p class="text-xs text-text-secondary">{{ 'coinEconomy.report.corrections' | t }}</p>
                <p class="text-lg font-semibold">{{ report.correction_count }} ({{ report.corrections_given }} / {{ report.corrections_received }})</p>
              </div>
            </div>

            <!-- Engagement rating -->
            <div class="bg-surface-200 rounded-xl p-4">
              <p class="text-sm font-semibold">{{ 'coinEconomy.report.engagementRating' | t }}</p>
              <p class="text-lg">{{ report.engagement_rating }}</p>
            </div>

            <!-- Key Insights -->
            @if (report.key_insights.length > 0) {
              <div class="bg-surface-200 rounded-xl p-4">
                <p class="text-sm font-semibold mb-2">{{ 'coinEconomy.report.keyInsights' | t }}</p>
                <ul class="list-disc list-inside space-y-1">
                  @for (insight of report.key_insights; track insight) {
                    <li class="text-sm text-text-secondary">{{ insight }}</li>
                  }
                </ul>
              </div>
            }

            <!-- Suggestions -->
            @if (report.suggestions.length > 0) {
              <div class="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                <p class="text-sm font-semibold mb-2">{{ 'coinEconomy.report.suggestions' | t }}</p>
                <ul class="list-disc list-inside space-y-1">
                  @for (suggestion of report.suggestions; track suggestion) {
                    <li class="text-sm">{{ suggestion }}</li>
                  }
                </ul>
              </div>
            }
          </div>
        </app-card>
      </div>
    </section>
  }

  <!-- Recent Activity -->
  <section class="ps-4 pe-4 pb-12 md:ps-8 md:pe-8">
    <div class="max-w-4xl mx-auto">
      <h2 class="text-xl font-bold mb-4">{{ 'coinEconomy.recentActivity' | t }}</h2>
      <app-card variant="outlined" padding="md">
        <div class="space-y-3">
          <!-- Gift Catalog Preview -->
          @if (economyStore.catalog().length > 0) {
            <div>
              <h3 class="text-sm font-semibold text-text-secondary uppercase mb-2">{{ 'coinEconomy.popularGifts' | t }}</h3>
              <div class="flex flex-wrap gap-3">
                @for (gift of economyStore.catalog().slice(0, 5); track gift.id) {
                  <div class="flex items-center gap-2 rounded-full bg-surface-200 px-3 py-1.5 text-sm">
                    <span>{{ gift.icon }}</span>
                    <span class="font-medium">{{ gift.name }}</span>
                    <span class="text-amber-400 font-semibold">{{ gift.cost_coins }}</span>
                  </div>
                }
              </div>
            </div>
          }
          <!-- Sticker Packs Preview -->
          @if (economyStore.stickerPacks().length > 0) {
            <div>
              <h3 class="text-sm font-semibold text-text-secondary uppercase mb-2">{{ 'coinEconomy.yourStickerPacks' | t }}</h3>
              <div class="flex flex-wrap gap-2">
                @for (pack of economyStore.stickerPacks().slice(0, 5); track pack.id) {
                  <span
                    class="rounded-full px-3 py-1 text-xs font-medium"
                    [class.bg-emerald-500/20]="pack.owned"
                    [class.text-emerald-400]="pack.owned"
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
  
  /** Partner ID input for the unlock dialog */
  partnerIdInput = '';

  ngAfterViewInit(): void {
    void this.economyStore.loadInitialData();
    void this.economyStore.loadPremiumServices();
    this.maybeStartTour();
  }

  getTransactionTypeLabel(type: TransactionRecord['type']): string {
    return this.i18n.translate(`coinEconomy.transaction.${type}`);
  }

  openUnlockDialog(service: PremiumAiService): void {
    const partnerId = this.partnerIdInput.trim();
    if (!partnerId) {
      return;
    }
    void this.economyStore.unlockPremiumService(service.id, partnerId);
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
