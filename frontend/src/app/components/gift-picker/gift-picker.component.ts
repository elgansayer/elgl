import { Component, input, output, inject, signal, computed } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { EconomyStore, VirtualGift } from '../../services/economy.store';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';

@Component({
  selector: 'app-gift-picker',
  imports: [TranslatePipe, AppEmptyStateComponent, AppSkeletonLoaderComponent],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div
        class="bg-surface-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-surface-100 space-y-5 animate-fadeIn"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 class="text-xl font-black text-text-primary flex items-center gap-2">
              <span>🎁</span>
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

        <!-- Coin balance bar -->
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
            {{ (showCoinPackages ? 'giftModal.backToGiftsBtn' : 'giftModal.buyCoinsBtn') | t }}
          </button>
        </div>

        @if (showCoinPackages) {
          <div class="space-y-3 animate-fadeIn">
            <span class="text-xs font-bold text-text-primary block">{{
              'giftModal.bundlePrompt' | t
            }}</span>
            @if (economyStore.coinPackages().length === 0) {
              <app-empty-state
                icon="&#x1FA99;"
                [title]="'giftModal.noPackagesTitle' | t"
                [description]="'giftModal.noPackagesDescription' | t"
              />
            } @else {
              <div class="grid grid-cols-1 gap-2.5">
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
            }
          </div>
        }

        @if (!showCoinPackages) {
          <div class="space-y-3">
            @if (!selectedGift) {
              <span class="text-xs font-bold text-text-primary block">{{
                'giftModal.selectPrompt' | t: { name: receiverName() }
              }}</span>
            }
            @if (selectedGift) {
              <div class="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/20">
                <span class="text-3xl">{{ selectedGift.icon }}</span>
                <div class="flex-1">
                  <span class="font-bold text-sm text-text-primary block">{{ selectedGift.name }}</span>
                  <span class="text-xs text-text-secondary">{{
                    'giftModal.giftCost' | t: { cost: selectedGift.cost_coins }
                  }}</span>
                </div>
                <button
                  (click)="selectedGift = null; deductedAmount.set(0)"
                  class="text-text-muted hover:text-text-secondary text-sm"
                >
                  ✕
                </button>
              </div>
            }
            @if (!selectedGift) {
              @if (isCatalogLoading()) {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5" aria-hidden="true">
                  @for (sk of skeletonCount(); track sk) {
                    <div class="p-2.5 rounded-2xl flex flex-col items-center text-center space-y-1">
                      <app-skeleton-loader height="32px" width="32px" borderRadius="50%" variant="circle" />
                      <app-skeleton-loader height="12px" width="80%" borderRadius="4px" variant="text" />
                      <app-skeleton-loader height="10px" width="60%" borderRadius="4px" variant="text" />
                    </div>
                  }
                </div>
              } @else if (economyStore.catalog().length === 0) {
                <app-empty-state
                  icon="&#x1F381;"
                  [title]="'giftModal.noCatalogTitle' | t"
                  [description]="'giftModal.noCatalogDescription' | t"
                />
              } @else {
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto">
                  @for (gift of economyStore.catalog(); track gift.id) {
                    <button
                      type="button"
                      (click)="selectGift(gift)"
                      [disabled]="gift.cost_coins > effectiveBalance()"
                      [class]="
                        'w-full p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center text-center space-y-1 ' +
                        (gift.cost_coins > effectiveBalance()
                          ? 'border-surface-100 bg-surface-300 opacity-40 cursor-not-allowed'
                          : 'border-surface-100 hover:border-primary/50 bg-surface-300 cursor-pointer')
                      "
                    >
                      <span class="text-2xl block">{{ gift.icon }}</span>
                      <span class="font-bold text-[10px] text-text-primary block truncate w-full">{{
                        gift.name
                      }}</span>
                      <span class="text-[10px] font-extrabold text-amber-600">{{
                        'giftModal.giftCost' | t: { cost: gift.cost_coins }
                      }}</span>
                    </button>
                  }
                </div>
              }
            }
          </div>
        }

        <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button
            (click)="closed.emit()"
            class="px-4 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs text-text-secondary"
          >
            {{ 'giftModal.cancelBtn' | t }}
          </button>
          @if (!showCoinPackages) {
            <button
              [disabled]="!selectedGift || isSending"
              (click)="confirmSend()"
              class="px-6 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-xl font-extrabold text-xs shadow transition-all"
            >
              {{
                isSending
                  ? ('giftModal.sendingBtn' | t)
                  : selectedGift
                    ? ('giftModal.sendBtnText'
                      | t: { icon: selectedGift.icon, cost: selectedGift.cost_coins })
                    : ('giftModal.selectGift' | t)
              }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
})
export class GiftPickerComponent {
  receiverId = input.required<string>();
  receiverName = input.required<string>();
  roomId = input<string>();
  closed = output<void>();

  readonly economyStore = inject(EconomyStore);
  selectedGift: VirtualGift | null = null;
  showCoinPackages = false;
  isSending = false;
  deductedAmount = signal(0);

  readonly isCatalogLoading = computed(() => this.economyStore.isLoading());
  readonly skeletonCount = computed(() => Array.from({ length: 6 }, (_, i) => i));

  effectiveBalance = () => this.economyStore.coinsBalance() - this.deductedAmount();

  toggleCoinPackages(): void {
    this.showCoinPackages = !this.showCoinPackages;
    if (this.showCoinPackages && this.economyStore.coinPackages().length === 0) {
      void this.economyStore.loadCoinPackages();
    }
  }

  buyCoins(packageId: string): void {
    void this.economyStore.buyCoins(packageId);
  }

  selectGift(gift: VirtualGift): void {
    this.selectedGift = gift;
    this.deductedAmount.set(gift.cost_coins);
  }

  async confirmSend(): Promise<void> {
    if (!this.selectedGift) return;
    this.isSending = true;
    const gift = this.selectedGift;
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
      this.isSending = false;
    }
  }
}
