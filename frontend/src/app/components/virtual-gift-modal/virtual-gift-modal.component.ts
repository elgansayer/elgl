import { Component, EventEmitter, Input, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EconomyStore, VirtualGift } from '../../services/economy.store';

@Component({
  selector: 'app-virtual-gift-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div
        class="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-5 animate-fadeIn"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3"
        >
          <div>
            <h3 class="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>🎁 Send Virtual Gift to Host</span>
            </h3>
            <p class="text-xs text-slate-500">Support language partners with animated tokens</p>
          </div>
          <button
            (click)="closed.emit()"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <!-- Coin Balance & Buy Coins Bar -->
        <div
          class="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <span class="text-2xl">💰</span>
            <div>
              <span
                class="text-[10px] uppercase font-black text-amber-800 dark:text-amber-300 block"
                >Your Coin Balance:</span
              >
              <span class="text-lg font-extrabold text-amber-950 dark:text-white"
                >{{ economyStore.coinsBalance() }} Coins</span
              >
            </div>
          </div>

          <button
            (click)="showCoinPackages = !showCoinPackages"
            class="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow"
          >
            {{ showCoinPackages ? 'Back to Gifts' : '+ Buy Coins' }}
          </button>
        </div>

        <!-- Coin Packages View if buying -->
        @if (showCoinPackages) {
          <div class="space-y-3 animate-fadeIn">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300 block"
              >Select a coin bundle to recharge:</span
            >
            <div class="grid grid-cols-1 gap-2.5">
              <div
                class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">🪙</span>
                  <div>
                    <span class="font-black text-sm text-slate-800 dark:text-slate-100"
                      >Starter Pouch (100 Coins)</span
                    >
                    <span class="text-xs text-slate-500 block"
                      >Great for sending roses and coffees</span
                    >
                  </div>
                </div>
                <button
                  (click)="buyCoins('small', 100)"
                  class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow"
                >
                  2 UKP / $2.60 USD
                </button>
              </div>
              <div
                class="p-3.5 rounded-2xl border-2 border-amber-400 dark:border-amber-500 bg-amber-50/30 dark:bg-amber-950/20 flex items-center justify-between"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">💰</span>
                  <div>
                    <span class="font-black text-sm text-slate-800 dark:text-slate-100"
                      >Popular Chest (500 Coins)</span
                    >
                    <span class="text-xs text-amber-600 dark:text-amber-400 font-bold block"
                      >🔥 Most Popular Bundle</span
                    >
                  </div>
                </div>
                <button
                  (click)="buyCoins('medium', 500)"
                  class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl text-xs shadow"
                >
                  8 UKP / $10 USD
                </button>
              </div>
              <div
                class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between"
              >
                <div class="flex items-center gap-3">
                  <span class="text-2xl">💎</span>
                  <div>
                    <span class="font-black text-sm text-slate-800 dark:text-slate-100"
                      >Royal Vault (2,000 Coins)</span
                    >
                    <span class="text-xs text-slate-500 block"
                      >Unlock crowns and rocket boosts</span
                    >
                  </div>
                </div>
                <button
                  (click)="buyCoins('large', 2000)"
                  class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-xl text-xs shadow"
                >
                  25 UKP / $32 USD
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Gift Catalog Grid when sending -->
        @if (!showCoinPackages) {
          <div class="space-y-3">
            <span class="text-xs font-bold text-slate-700 dark:text-slate-300 block"
              >Select virtual gift to send to {{ receiverName }}:</span
            >
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              @for (gift of economyStore.catalog(); track gift) {
                <div
                  (click)="selectedGift = gift"
                  class="p-3 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center text-center space-y-1.5"
                  [ngClass]="
                    selectedGift?.id === gift.id
                      ? 'border-primary bg-primary/5 shadow-md scale-105'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-slate-50 dark:bg-slate-900/40'
                  "
                >
                  <span class="text-3xl block">{{ gift.icon }}</span>
                  <span
                    class="font-bold text-xs text-slate-800 dark:text-slate-200 block truncate w-full"
                    >{{ gift.name }}</span
                  >
                  <span class="text-[11px] font-extrabold text-amber-600 dark:text-amber-400"
                    >🪙 {{ gift.cost_coins }} Coins</span
                  >
                </div>
              }
            </div>
          </div>
        }

        <!-- Footer actions -->
        <div class="flex justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
          <button
            (click)="closed.emit()"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl font-bold text-xs"
          >
            Cancel
          </button>
          @if (!showCoinPackages) {
            <button
              [disabled]="!selectedGift || isSending"
              (click)="confirmSend()"
              class="px-6 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-xl font-extrabold text-xs shadow transition-all"
            >
              {{
                isSending
                  ? 'Sending...'
                  : selectedGift
                    ? '🎁 Send ' + selectedGift.icon + ' (' + selectedGift.cost_coins + ' coins)'
                    : 'Select a Gift'
              }}
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class VirtualGiftModalComponent implements OnInit {
  @Input({ required: true }) receiverId = '';
  @Input({ required: true }) receiverName = 'Host';
  @Input() roomId?: string;
  @Output() closed = new EventEmitter<void>();

  readonly economyStore = inject(EconomyStore);
  selectedGift: VirtualGift | null = null;
  showCoinPackages = false;
  isSending = false;

  async ngOnInit(): Promise<void> {
    if (this.economyStore.catalog().length === 0) {
      await this.economyStore.loadInitialData();
    }
  }

  async buyCoins(packageId: string, amount: number): Promise<void> {
    await this.economyStore.purchaseCoins(packageId, amount);
  }

  async confirmSend(): Promise<void> {
    if (!this.selectedGift) return;
    this.isSending = true;
    try {
      const ok = await this.economyStore.sendGift(
        this.receiverId,
        this.selectedGift.id,
        this.roomId,
      );
      if (ok) {
        this.economyStore.triggerGiftAnimation({
          gift: this.selectedGift,
          sender_name: 'You',
          receiver_name: this.receiverName,
        });
        this.closed.emit();
      }
    } finally {
      this.isSending = false;
    }
  }
}
