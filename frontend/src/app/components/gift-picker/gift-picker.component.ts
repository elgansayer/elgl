import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';
import { EconomyStore, VirtualGift } from '../../services/economy.store';

@Component({
  selector: 'app-gift-picker',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <hlm-dialog state="open" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl border border-surface-100 bg-surface-200 p-4 shadow-2xl sm:space-y-5 sm:rounded-3xl sm:p-6"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="subtitleId"
      >
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 [id]="titleId" class="flex items-center gap-2 text-xl font-black text-text-primary">
              <span aria-hidden="true">🎁</span>
              <span>{{ 'giftModal.title' | t }}</span>
            </h3>
            <p [id]="subtitleId" class="text-xs text-text-secondary">
              {{ 'giftModal.subtitle' | t }}
            </p>
          </div>
          <button
            hlmBtn
            type="button"
            variant="ghost"
            size="icon-touch"
            [disabled]="isSending()"
            (click)="closed.emit()"
            [attr.aria-label]="'common.close' | t"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div
          class="flex items-center justify-between gap-3 rounded-2xl border border-vip/30 bg-vip/10 p-4"
        >
          <div class="flex min-w-0 items-center gap-2">
            <span class="shrink-0 text-2xl" aria-hidden="true">💰</span>
            <div class="min-w-0">
              <span class="block text-[10px] font-black uppercase text-vip">{{
                'giftModal.balanceLabel' | t
              }}</span>
              <span class="text-lg font-extrabold text-vip" aria-live="polite">
                {{ 'giftModal.coinsValue' | t: { coins: effectiveBalance() } }}
              </span>
            </div>
          </div>
          <button
            hlmBtn
            type="button"
            variant="secondary"
            size="sm"
            class="shrink-0 text-vip"
            [disabled]="isSending() || !economyStore.isOnline()"
            (click)="toggleCoinPackages()"
          >
            {{ (showCoinPackages() ? 'giftModal.backToGiftsBtn' : 'giftModal.buyCoinsBtn') | t }}
          </button>
        </div>

        @if (showCoinPackages()) {
          <div class="animate-fadeIn space-y-3">
            <span class="block text-xs font-bold text-text-primary">{{
              'giftModal.bundlePrompt' | t
            }}</span>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              @for (pkg of economyStore.coinPackages(); track pkg.id) {
                <div
                  class="flex items-center justify-between gap-3 rounded-2xl border border-surface-100 bg-surface-300 p-3.5"
                >
                  <div class="flex min-w-0 items-center gap-3">
                    <span class="shrink-0 text-2xl" aria-hidden="true">🪙</span>
                    <div class="min-w-0">
                      <span class="break-words text-sm font-black text-text-primary">
                        {{
                          'giftModal.package.' + pkg.id + '.title'
                            | t: { coins: pkg.coins, name: pkg.name }
                        }}
                      </span>
                      <span class="block break-words text-xs text-text-secondary">{{
                        'giftModal.package.' + pkg.id + '.desc' | t
                      }}</span>
                    </div>
                  </div>
                  <button
                    hlmBtn
                    type="button"
                    size="sm"
                    class="shrink-0"
                    [disabled]="isSending() || !economyStore.isOnline()"
                    (click)="buyCoins(pkg.id)"
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
        } @else {
          <div class="space-y-3">
            @if (!selectedGift()) {
              <span class="block text-xs font-bold text-text-primary">
                {{ 'giftModal.selectPrompt' | t: { name: receiverName() } }}
              </span>
            }
            @if (selectedGift(); as gift) {
              <div
                class="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3"
              >
                <span class="shrink-0 text-3xl" aria-hidden="true">{{ gift.icon }}</span>
                <div class="min-w-0 flex-1">
                  <span class="block break-words text-sm font-bold text-text-primary">{{ gift.name }}</span>
                  <span class="text-xs text-text-secondary">{{
                    'giftModal.giftCost' | t: { cost: gift.cost_coins }
                  }}</span>
                </div>
                <button
                  hlmBtn
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  [disabled]="isSending()"
                  (click)="clearSelection()"
                  [attr.aria-label]="'giftModal.deselectAria' | t: { name: gift.name }"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            } @else {
              <div
                class="grid max-h-64 grid-cols-2 gap-2.5 overflow-y-auto xs:grid-cols-3 sm:grid-cols-4"
                role="radiogroup"
                [attr.aria-label]="'giftModal.giftListAria' | t"
              >
                @for (gift of economyStore.catalog(); track gift.id) {
                  <button
                    hlmBtn
                    type="button"
                    variant="outline"
                    size="touch"
                    role="radio"
                    class="h-auto w-full flex-col space-y-1 rounded-2xl p-2.5 text-center"
                    (click)="selectGift(gift)"
                    [disabled]="
                      isSending() || !economyStore.isOnline() || gift.cost_coins > effectiveBalance()
                    "
                    [attr.aria-checked]="selectedGift()?.id === gift.id"
                    [attr.aria-label]="
                      'giftModal.giftAria' | t: { name: gift.name, cost: gift.cost_coins }
                    "
                  >
                    <span class="block text-2xl" aria-hidden="true">{{ gift.icon }}</span>
                    <span class="block w-full truncate text-[10px] font-bold text-text-primary">{{
                      gift.name
                    }}</span>
                    <span class="text-[10px] font-extrabold text-vip">{{
                      'giftModal.giftCost' | t: { cost: gift.cost_coins }
                    }}</span>
                  </button>
                }
              </div>
            }
          </div>
        }

        <div class="flex flex-wrap justify-end gap-3 border-t border-surface-100 pt-2">
          <button
            hlmBtn
            type="button"
            variant="secondary"
            size="touch"
            [disabled]="isSending()"
            (click)="closed.emit()"
          >
            {{ 'giftModal.cancelBtn' | t }}
          </button>
          @if (!showCoinPackages()) {
            @if (selectedGift(); as gift) {
              <button
                hlmBtn
                type="button"
                size="touch"
                [disabled]="!canSendSelectedGift()"
                (click)="confirmSend()"
                [attr.aria-busy]="isSending()"
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
              <button hlmBtn type="button" size="touch" disabled>
                {{ 'giftModal.selectGift' | t }}
              </button>
            }
          }
        </div>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
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

  readonly titleId = 'gift-picker-title-' + crypto.randomUUID();
  readonly subtitleId = 'gift-picker-subtitle-' + crypto.randomUUID();

  readonly effectiveBalance = computed(() => {
    const balance = this.economyStore.coinsBalance();
    return Number.isFinite(balance) && balance > 0 ? Math.floor(balance) : 0;
  });

  readonly canSendSelectedGift = computed(() => {
    const gift = this.selectedGift();
    return (
      !!gift &&
      this.economyStore.isOnline() &&
      !this.isSending() &&
      Number.isFinite(gift.cost_coins) &&
      gift.cost_coins >= 0 &&
      gift.cost_coins <= this.effectiveBalance()
    );
  });

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && !this.isSending()) this.closed.emit();
  }

  toggleCoinPackages(): void {
    if (this.isSending() || !this.economyStore.isOnline()) return;
    this.showCoinPackages.update((value) => !value);
    if (this.showCoinPackages() && this.economyStore.coinPackages().length === 0) {
      void this.economyStore.loadCoinPackages();
    }
  }

  buyCoins(packageId: string): void {
    if (this.isSending() || !this.economyStore.isOnline()) return;
    void this.economyStore.buyCoins(packageId);
  }

  selectGift(gift: VirtualGift): void {
    if (
      this.isSending() ||
      !this.economyStore.isOnline() ||
      !Number.isFinite(gift.cost_coins) ||
      gift.cost_coins < 0 ||
      gift.cost_coins > this.effectiveBalance()
    ) {
      return;
    }
    this.selectedGift.set(gift);
  }

  clearSelection(): void {
    if (this.isSending()) return;
    this.selectedGift.set(null);
  }

  async confirmSend(): Promise<void> {
    const gift = this.selectedGift();
    if (!gift || !this.canSendSelectedGift()) return;

    this.isSending.set(true);
    try {
      const ok = await this.economyStore.sendGift(this.receiverId(), gift.id, this.roomId());
      if (!ok) return;

      this.economyStore.triggerGiftAnimation({
        gift,
        sender_name: 'You',
        receiver_name: this.receiverName(),
      });
      this.closed.emit();
    } finally {
      this.isSending.set(false);
    }
  }
}
