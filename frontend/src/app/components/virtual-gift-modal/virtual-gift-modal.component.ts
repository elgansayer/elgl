import { Component, input, output, inject, signal } from '@angular/core';

import { EconomyStore, VirtualGift } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-virtual-gift-modal',
  imports: [TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      (click)="onBackdropClick($event)"
      (keydown.escape)="closed.emit()"
    >
      <div
        class="bg-surface-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-surface-100 space-y-5 animate-fadeIn focus:outline-none"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'giftModal.title' | t"
      >
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 id="gift-modal-title" class="text-xl font-black text-text-primary flex items-center gap-2">
              <span>{{ 'giftModal.title' | t }}</span>
            </h3>
            <p class="text-xs text-text-secondary">
              {{ 'giftModal.subtitle' | t }}
            </p>
          </div>
          <button
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary rounded-lg px-1"
            [attr.aria-label]="'giftModal.closeBtnAria' | t"
          >
            \u2715
          </button>
        </div>

        <div
          class="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30 flex items-center justify-between"
        >
          <div class="flex items-center gap-2" aria-live="polite">
            <span class="text-2xl" aria-hidden="true">\U0001F4B0</span>
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
            class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            {{ (showCoinPackages ? 'giftModal.backToGiftsBtn' : 'giftModal.buyCoinsBtn') | t }}
          </button>
        </div>

        @if (showCoinPackages) {
          <div class="space-y-3 animate-fadeIn">
            <span class="text-xs font-bold text-text-primary block">{{
              'giftModal.bundlePrompt' | t
            }}</span>
            <div class="grid grid-cols-1 gap-2.5" role="list">
              @for (pkg of economyStore.coinPackages(); track pkg.id) {
                <div
                  role="listitem"
                  class="p-3.5 rounded-2xl border border-surface-100 bg-surface-300 flex items-center justify-between"
                >
                  <div class="flex items-center gap-3">
                    <span class="text-2xl" aria-hidden="true">\U0001FA99</span>
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
                    class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    [attr.aria-label]="'giftModal.buyPackageAria' | t: { name: pkg.name, coins: pkg.coins }"
                  >
                    {{ 'giftModal.priceLabel' | t: { ukp: pkg.price_ukp, usd: pkg.price_usd } }}
                  </button>
                </div>
              }
            </div>
          </div>
        }

        @if (!showCoinPackages) {
          <div class="space-y-3">
            <span class="text-xs font-bold text-text-primary block">{{
              'giftModal.selectPrompt' | t: { name: receiverName() }
            }}</span>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3" role="radiogroup" [attr.aria-label]="'giftModal.giftGridAria' | t">
              @for (gift of economyStore.catalog(); track gift.id) {
                <button
                  type="button"
                  role="radio"
                  (click)="selectGift(gift)"
                  [disabled]="gift.cost_coins > effectiveBalance()"
                  [attr.aria-checked]="selectedGift?.id === gift.id"
                  [attr.aria-label]="'giftModal.giftAriaLabel' | t: { name: gift.name, cost: gift.cost_coins }"
                  [attr.aria-disabled]="gift.cost_coins > effectiveBalance()"
                  [class]="
                    'w-full p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center space-y-1.5 focus:outline-none focus:ring-2 focus:ring-primary ' +
                    (selectedGift?.id === gift.id
                      ? 'border-primary bg-primary/5 shadow-md scale-105'
                      : gift.cost_coins > effectiveBalance()
                        ? 'border-surface-100 bg-surface-300 opacity-40 cursor-not-allowed'
                        : 'border-surface-100 hover:border-primary/50 bg-surface-300 cursor-pointer')
                  "
                >
                  <span class="text-3xl block" aria-hidden="true">{{ gift.icon }}</span>
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
            class="px-4 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {{ 'giftModal.cancelBtn' | t }}
          </button>
          @if (!showCoinPackages) {
            <button
              [disabled]="!selectedGift || isSending"
              [attr.aria-disabled]="(!selectedGift || isSending) ? true : undefined"
              (click)="confirmSend()"
              class="px-6 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-xl font-extrabold text-xs shadow transition-all focus:outline-none focus:ring-2 focus:ring-primary"
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
})
export class VirtualGiftModalComponent {
  receiverId = input.required<string>();
  receiverName = input<string>('');
  roomId = input<string>();
  closed = output<void>();

  readonly economyStore = inject(EconomyStore);
  selectedGift: VirtualGift | null = null;
  showCoinPackages = false;
  isSending = false;
  deductedAmount = signal(0);

  effectiveBalance = (): number => this.economyStore.coinsBalance() - this.deductedAmount();

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

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
