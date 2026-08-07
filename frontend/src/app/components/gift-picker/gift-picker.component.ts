import { Component, input, output, inject, signal, computed } from '@angular/core';

import { TranslatePipe } from '../../services/translate.pipe';
import { EconomyStore, VirtualGift } from '../../services/economy.store';

@Component({
  selector: 'app-gift-picker',
  imports: [TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="dialogTitleId"
      (keydown.escape)="closed.emit()"
    >
      <div
        class="bg-surface-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl border border-surface-100 space-y-4 sm:space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 [id]="dialogTitleId" class="text-xl font-black text-text-primary flex items-center gap-2">
              <span aria-hidden="true">🎁</span>
              <span>{{ 'giftModal.title' | t }}</span>
            </h3>
            <p class="text-xs text-text-secondary">
              {{ 'giftModal.subtitle' | t }}
            </p>
          </div>
          <button
            type="button"
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold"
            [attr.aria-label]="'common.close' | t"
          >
            ✕
          </button>
        </div>

        <!-- Coin balance bar -->
        <div
          class="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30 flex items-center justify-between"
          role="region"
          [attr.aria-label]="'giftModal.balanceLabel' | t"
        >
          <div class="flex items-center gap-2">
            <span class="text-2xl" aria-hidden="true">💰</span>
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
            type="button"
            (click)="toggleCoinPackages()"
            class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow"
          >
            {{ (showCoinPackages() ? 'giftModal.backToGiftsBtn' : 'giftModal.buyCoinsBtn') | t }}
          </button>
        </div>

        @if (showCoinPackages()) {
          <div class="space-y-3 animate-fadeIn" role="region" [attr.aria-label]="'giftModal.bundlePrompt' | t">
            <span class="text-xs font-bold text-text-primary block">{{
              'giftModal.bundlePrompt' | t
            }}</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="list">
              @for (pkg of economyStore.coinPackages(); track pkg.id) {
                <div
                  class="p-3.5 rounded-2xl border border-surface-100 bg-surface-300 flex items-center justify-between"
                  role="listitem"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-2xl" aria-hidden="true">🪙</span>
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
                    type="button"
                    (click)="buyCoins(pkg.id)"
                    class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow"
                    [attr.aria-label]="'giftModal.priceLabel' | t: { ukp: pkg.price_ukp, usd: pkg.price_usd }"
                  >
                    {{ 'giftModal.priceLabel' | t: { ukp: pkg.price_ukp, usd: pkg.price_usd } }}
                  </button>
                </div>
              }
            </div>
          </div>
        }

        @if (!showCoinPackages()) {
          <div class="space-y-3" role="region" [attr.aria-label]="'giftModal.selectPrompt' | t: { name: receiverName() }">
            @if (!selectedGift()) {
              <span class="text-xs font-bold text-text-primary block">{{
                'giftModal.selectPrompt' | t: { name: receiverName() }
              }}</span>
            }
            @if (selectedGift(); as gift) {
              <div class="flex items-center gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/20">
                <span class="text-3xl" aria-hidden="true">{{ gift.icon }}</span>
                <div class="flex-1">
                  <span class="font-bold text-sm text-text-primary block">{{ gift.name }}</span>
                  <span class="text-xs text-text-secondary">{{
                    'giftModal.giftCost' | t: { cost: gift.cost_coins }
                  }}</span>
                </div>
                <button
                  type="button"
                  (click)="selectedGift.set(null); deductedAmount.set(0)"
                  class="text-text-muted hover:text-text-secondary text-sm"
                  [attr.aria-label]="'common.deselect' | t"
                >
                  ✕
                </button>
              </div>
            }
            @if (!selectedGift()) {
              <div class="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto" role="list">
                @for (gift of economyStore.catalog(); track gift.id) {
                  <button
                    type="button"
                    role="listitem"
                    (click)="selectGift(gift)"
                    [disabled]="gift.cost_coins > effectiveBalance()"
                    [attr.aria-label]="gift.name + ', ' + ('giftModal.giftCost' | t: { cost: gift.cost_coins })"
                    [attr.aria-pressed]="selectedGift()?.id === gift.id"
                    [class]="
                      'w-full p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center text-center space-y-1 ' +
                      (gift.cost_coins > effectiveBalance()
                        ? 'border-surface-100 bg-surface-300 opacity-40 cursor-not-allowed'
                        : 'border-surface-100 hover:border-primary/50 bg-surface-300 cursor-pointer')
                    "
                  >
                    <span class="text-2xl block" aria-hidden="true">{{ gift.icon }}</span>
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
          </div>
        }

        <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button
            type="button"
            (click)="closed.emit()"
            class="px-4 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs text-text-secondary"
          >
            {{ 'giftModal.cancelBtn' | t }}
          </button>
          @if (!showCoinPackages()) {
            @if (selectedGift(); as gift) {
              <button
                type="button"
                [disabled]="isSending()"
                (click)="confirmSend()"
                class="px-6 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-xl font-extrabold text-xs shadow transition-all"
              >
                {{
                  isSending()
                    ? ('giftModal.sendingBtn' | t)
                    : ('giftModal.sendBtnText' | t: { icon: gift.icon, cost: gift.cost_coins })
                }}
              </button>
            } @else {
              <button
                type="button"
                disabled
                class="px-6 py-2 bg-primary opacity-50 text-white rounded-xl font-extrabold text-xs shadow"
              >
                {{ 'giftModal.selectGift' | t }}
              </button>
            }
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

  readonly selectedGift = signal<VirtualGift | null>(null);
  readonly showCoinPackages = signal(false);
  readonly isSending = signal(false);
  readonly deductedAmount = signal(0);
  readonly dialogTitleId = 'gift-picker-title-' + Math.random().toString(36).substring(2, 9);

  readonly effectiveBalance = computed(() => this.economyStore.coinsBalance() - this.deductedAmount());

  toggleCoinPackages(): void {
    this.showCoinPackages.update((v) => !v);
    if (this.showCoinPackages() && this.economyStore.coinPackages().length === 0) {
      void this.economyStore.loadCoinPackages();
    }
  }

  buyCoins(packageId: string): void {
    void this.economyStore.buyCoins(packageId);
  }

  selectGift(gift: VirtualGift): void {
    this.selectedGift.set(gift);
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
