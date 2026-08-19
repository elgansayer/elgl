import { HlmButton } from '@spartan-ng/helm/button';
import { Component, input, output, inject, signal, computed } from '@angular/core';

import { EconomyStore, VirtualGift } from '../../services/economy.store';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-virtual-gift-modal',
  imports: [HlmButton, TranslatePipe],
  template: `
    <div
      class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="subtitleId"
      (keydown.escape)="closed.emit()"
    >
      <div
        class="bg-surface-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-lg w-full shadow-2xl border border-surface-100 space-y-4 sm:space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto"
      >
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 [id]="titleId" class="text-xl font-black text-text-primary flex items-center gap-2">
              <span>{{ 'giftModal.title' | t }}</span>
            </h3>
            <p [id]="subtitleId" class="text-xs text-text-secondary">
              {{ 'giftModal.subtitle' | t }}
            </p>
          </div>
          <button
            hlmBtn
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold"
            [attr.aria-label]="'common.close' | t"
          >
            ✕
          </button>
        </div>

        <div
          class="bg-vip/10 p-4 rounded-2xl border border-vip/30 flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <span class="text-2xl" aria-hidden="true">💰</span>
            <div>
              <span class="text-[10px] uppercase font-black text-vip block">{{
                'giftModal.balanceLabel' | t
              }}</span>
              <span class="text-lg font-extrabold text-vip" aria-live="polite">{{
                'giftModal.coinsValue' | t: { coins: effectiveBalance() }
              }}</span>
            </div>
          </div>

          <button
            hlmBtn
            (click)="toggleCoinPackages()"
            class="px-3.5 py-1.5 bg-vip hover:bg-vip/90 text-on-fill rounded-xl text-xs font-bold shadow"
          >
            {{ (showCoinPackages() ? 'giftModal.backToGiftsBtn' : 'giftModal.buyCoinsBtn') | t }}
          </button>
        </div>

        @if (showCoinPackages()) {
          <div class="space-y-3 animate-fadeIn">
            <span class="text-xs font-bold text-text-primary block">{{
              'giftModal.bundlePrompt' | t
            }}</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              @for (pkg of economyStore.coinPackages(); track pkg.id) {
                <div
                  class="p-3.5 rounded-2xl border border-surface-100 bg-surface-300 flex items-center justify-between"
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
                    hlmBtn
                    (click)="buyCoins(pkg.id)"
                    class="px-4 py-2 bg-success hover:bg-success/90 text-on-fill font-extrabold rounded-xl text-xs shadow"
                    [attr.aria-label]="
                      'giftModal.purchaseAria' | t: { coins: pkg.coins, name: pkg.name }
                    "
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
            <div
              class="grid grid-cols-2 sm:grid-cols-3 gap-3"
              role="radiogroup"
              [attr.aria-label]="'giftModal.giftListAria' | t"
            >
              @for (gift of economyStore.catalog(); track gift.id) {
                <button
                  hlmBtn
                  type="button"
                  role="radio"
                  (click)="selectGift(gift)"
                  [disabled]="gift.cost_coins > effectiveBalance()"
                  [attr.aria-checked]="selectedGift()?.id === gift.id"
                  [attr.aria-label]="
                    'giftModal.giftAria' | t: { name: gift.name, cost: gift.cost_coins }
                  "
                  [class]="
                    'w-full p-3 rounded-2xl border-2 transition-all flex flex-col items-center text-center space-y-1.5 ' +
                    (selectedGift()?.id === gift.id
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
                  <span class="text-[11px] font-extrabold text-vip">{{
                    'giftModal.giftCost' | t: { cost: gift.cost_coins }
                  }}</span>
                </button>
              }
            </div>
          </div>
        }

        <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button
            hlmBtn
            (click)="closed.emit()"
            class="px-4 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs"
          >
            {{ 'giftModal.cancelBtn' | t }}
          </button>
          @if (!showCoinPackages()) {
            @if (selectedGift(); as gift) {
              <button
                hlmBtn
                [disabled]="isSending()"
                (click)="confirmSend()"
                class="px-6 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-on-fill rounded-xl font-extrabold text-xs shadow transition-all"
                [attr.aria-label]="
                  'giftModal.sendAria'
                    | t: { name: gift.name, cost: gift.cost_coins, receiver: receiverName() }
                "
              >
                {{
                  isSending()
                    ? ('giftModal.sendingBtn' | t)
                    : ('giftModal.sendBtnText' | t: { icon: gift.icon, cost: gift.cost_coins })
                }}
              </button>
            } @else {
              <button
                hlmBtn
                disabled
                class="px-6 py-2 bg-primary opacity-50 text-on-fill rounded-xl font-extrabold text-xs shadow"
              >
                {{ 'giftModal.selectGift' | t }}
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class VirtualGiftModalComponent {
  receiverId = input.required<string>();
  receiverName = input.required<string>();
  roomId = input<string>();
  closed = output<void>();

  readonly economyStore = inject(EconomyStore);

  readonly selectedGift = signal<VirtualGift | null>(null);
  readonly showCoinPackages = signal(false);
  readonly isSending = signal(false);
  readonly deductedAmount = signal(0);

  readonly titleId = 'virtual-gift-title-' + crypto.randomUUID();
  readonly subtitleId = 'virtual-gift-subtitle-' + crypto.randomUUID();

  readonly effectiveBalance = computed(
    (): number => this.economyStore.coinsBalance() - this.deductedAmount(),
  );

  private ensureDataLoaded(): void {
    if (this.economyStore.catalog().length === 0) {
      void this.economyStore.loadInitialData();
    }
  }

  toggleCoinPackages(): void {
    this.showCoinPackages.update((v) => !v);
    this.ensureDataLoaded();
    if (this.showCoinPackages() && this.economyStore.coinPackages().length === 0) {
      void this.economyStore.loadCoinPackages();
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
      const ok = await this.economyStore.sendGift(this.receiverId(), gift.id, this.roomId());
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
