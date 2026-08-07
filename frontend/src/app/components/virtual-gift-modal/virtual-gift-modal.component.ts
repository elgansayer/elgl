import { Component, input, output, inject, signal } from '@angular/core';

import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

import { EconomyStore, VirtualGift } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-virtual-gift-modal',
  imports: [TranslatePipe, AppSkeletonLoaderComponent],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div
        class="bg-surface-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-surface-100 space-y-5 animate-fadeIn"
      >
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 class="text-xl font-black text-text-primary flex items-center gap-2">
              <span>{{ 'giftModal.title' | t }}</span>
            </h3>
            <p class="text-xs text-text-secondary">
              {{ 'giftModal.subtitle' | t }}
            </p>
          </div>
          <button
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <div
          class="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30 flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <span class="text-2xl">💰</span>
            <div>
              <span class="text-[10px] uppercase font-black text-amber-400 block">{{
                'giftModal.balanceLabel' | t
              }}</span>
              <span class="text-lg font-extrabold text-amber-950">{{
                'giftModal.coinsValue' | t: { coins: effectiveBalance() }
              }}</span>
            </div>
          </div>

          <button
            (click)="toggleCoinPackages()"
            class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow"
          >
            {{ (showCoinPackages() ? 'giftModal.backToGiftsBtn' : 'giftModal.buyCoinsBtn') | t }}
          </button>
        </div>

        @if (showCoinPackages()) {
          <div class="space-y-3 animate-fadeIn">
            <span class="text-xs font-bold text-text-primary block">{{
              'giftModal.bundlePrompt' | t
            }}</span>
            <div class="grid grid-cols-1 gap-2.5">
              @if (isLoadingPackages()) {
                @for (skeleton of packageSkeletons; track skeleton) {
                  <div class="p-3.5 rounded-2xl border border-surface-100 bg-surface-300 flex items-center justify-between">
                    <div class="flex items-center gap-3 flex-1">
                      <app-skeleton-loader height="28px" width="28px" borderRadius="50%" variant="circle" />
                      <div class="flex-1 space-y-1.5">
                        <app-skeleton-loader height="14px" width="60%" borderRadius="4px" />
                        <app-skeleton-loader height="10px" width="40%" borderRadius="4px" />
                      </div>
                    </div>
                    <app-skeleton-loader height="28px" width="70px" borderRadius="12px" />
                  </div>
                }
              }
              @for (pkg of economyStore.coinPackages(); track pkg.id) {
                <div
                  class="p-3.5 rounded-2xl border border-surface-100 bg-surface-300 flex items-center justify-between"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">🪙</span>
                    <div>
                      <span class="font-black text-sm text-text-primary">{{
                        'giftModal.package.' + pkg.id + '.title'
                          | t: { coins: pkg.coins, name: pkg.name }
                      }}</span>
                      <span class="text-xs text-text-secondary block">{{
                        'giftModal.package.' + pkg.id + '.desc' | t
                      }}</span>
                    </div>
                  </div>
                  <button
                    (click)="buyCoins(pkg.id)"
                    class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow"
                  >
                    {{ 'giftModal.priceLabel' | t: { ukp: pkg.price_ukp, usd: pkg.price_usd } }}
                  </button>
                </div>
              }
            </div>
          </div>
        }

        @if (!showCoinPackages()) {
          <div class="space-y-3">
            <span class="text-xs font-bold text-text-primary block">{{
              'giftModal.selectPrompt' | t: { name: receiverName() }
            }}</span>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              @if (economyStore.catalog().length === 0) {
                @for (skeleton of giftSkeletons; track skeleton) {
                  <div class="w-full p-3 rounded-2xl border border-surface-100 bg-surface-300 flex flex-col items-center space-y-1.5">
                    <app-skeleton-loader height="28px" width="28px" borderRadius="50%" variant="circle" />
                    <app-skeleton-loader height="12px" width="70%" borderRadius="4px" />
                    <app-skeleton-loader height="10px" width="50%" borderRadius="4px" />
                  </div>
                }
              }
              @for (gift of economyStore.catalog(); track gift.id) {
                <button
                  type="button"
                  (click)="selectGift(gift)"
                  [disabled]="gift.cost_coins > effectiveBalance()"
                  [class]="
                    'w-full p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center space-y-1.5 ' +
                    (selectedGift()?.id === gift.id
                      ? 'border-primary bg-primary/5 shadow-md scale-105'
                      : gift.cost_coins > effectiveBalance()
                        ? 'border-surface-100 bg-surface-300 opacity-40 cursor-not-allowed'
                        : 'border-surface-100 hover:border-primary/50 bg-surface-300 cursor-pointer')
                  "
                >
                  <span class="text-3xl block">{{ gift.icon }}</span>
                  <span class="font-bold text-xs text-text-primary block truncate w-full">{{
                    gift.name
                  }}</span>
                  <span class="text-[11px] font-extrabold text-amber-600">{{
                    'giftModal.giftCost' | t: { cost: gift.cost_coins }
                  }}</span>
                </button>
              }
            </div>
          </div>
        }

        <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button
            (click)="closed.emit()"
            class="px-4 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs"
          >
            {{ 'giftModal.cancelBtn' | t }}
          </button>
          @if (!showCoinPackages()) {
            <button
              [disabled]="!selectedGift() || isSending()"
              (click)="confirmSend()"
              class="px-6 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-xl font-extrabold text-xs shadow transition-all"
            >
              {{
                isSending()
                  ? ('giftModal.sendingBtn' | t)
                  : selectedGift()
                    ? ('giftModal.sendBtnText'
                      | t: { icon: selectedGift().icon, cost: selectedGift().cost_coins })
                    : ('giftModal.selectGift' | t)
              }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class VirtualGiftModalComponent {
  receiverId = input.required<string>();
  receiverName = input.required<string>();
  roomId = input<string>();
  closed = output<void>();

  readonly economyStore = inject(EconomyStore);
<<<<<<< HEAD
  selectedGift: VirtualGift | null = null;
  showCoinPackages = false;
  isSending = false;
  deductedAmount = signal(0);
  readonly isLoadingPackages = signal(false);
  protected readonly giftSkeletons = [1, 2, 3, 4, 5, 6];
  protected readonly packageSkeletons = [1, 2, 3];
=======
  readonly selectedGift = signal<VirtualGift | null>(null);
  readonly showCoinPackages = signal(false);
  readonly isSending = signal(false);
  readonly deductedAmount = signal(0);
>>>>>>> origin/main

  readonly effectiveBalance = () => this.economyStore.coinsBalance() - this.deductedAmount();

  private ensureDataLoaded(): void {
    if (this.economyStore.catalog().length === 0) {
      void this.economyStore.loadInitialData();
    }
  }

  toggleCoinPackages(): void {
    this.showCoinPackages.update((v) => !v);
    this.ensureDataLoaded();
<<<<<<< HEAD
    if (this.showCoinPackages && this.economyStore.coinPackages().length === 0) {
      this.isLoadingPackages.set(true);
      void this.economyStore.loadCoinPackages().then(() => this.isLoadingPackages.set(false));
=======
    if (this.showCoinPackages() && this.economyStore.coinPackages().length === 0) {
      void this.economyStore.loadCoinPackages();
>>>>>>> origin/main
    }
  }

  buyCoins(packageId: string): void {
    void this.economyStore.buyCoins(packageId);
  }

  selectGift(gift: VirtualGift): void {
    this.selectedGift.set(gift);
    // Auto-deduction: preview the remaining balance after the gift cost
    this.deductedAmount.set(gift.cost_coins);
  }

  async confirmSend(): Promise<void> {
    const gift = this.selectedGift();
    if (!gift) return;
    this.isSending.set(true);
    try {
      const ok = await this.economyStore.sendGift(
        this.receiverId(),
        gift.id,
        this.roomId(),
      );
      if (ok) {
        this.economyStore.triggerGiftAnimation({
          gift,
          sender_name: 'You',
          receiver_name: this.receiverName(),
        });
        this.closed.emit();
      }
    } finally {
      this.isSending.set(false);
    }
  }
}
