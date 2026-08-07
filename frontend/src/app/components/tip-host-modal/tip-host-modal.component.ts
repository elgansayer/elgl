import { Component, input, output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { EconomyStore } from '../../services/economy.store';

@Component({
  selector: 'app-tip-host-modal',
  imports: [TranslatePipe, FormsModule],
  template: `
    <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" (click)="onBackdropClick($event)">
      <div class="bg-surface-200 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-surface-100 space-y-5 animate-fadeIn">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 class="text-xl font-black text-text-primary">{{ 'audioRoom.tipModalTitle' | t }}</h3>
            <p class="text-xs text-text-secondary">
              {{ 'audioRoom.tipModalSubtitle' | t }}
            </p>
          </div>
          <button
            (click)="closed.emit()"
            class="text-text-muted hover:text-text-secondary text-lg font-bold"
          >
            ✕
          </button>
        </div>

        <!-- Balance -->
        <div class="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/30 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-2xl">💰</span>
            <div>
              <span class="text-[10px] uppercase font-black text-amber-400 block">{{
                'audioRoom.tipBalanceLabel' | t
              }}</span>
              <span class="text-lg font-extrabold text-amber-950">{{
                economyStore.coinsBalance()
              }} 🪙</span>
            </div>
          </div>
        </div>

        <!-- Preset amounts -->
        <div class="grid grid-cols-2 gap-3">
          @for (amount of presetAmounts(); track amount) {
            <button
              (click)="selectAmount(amount)"
              [class]="
                'p-4 rounded-2xl border-2 transition-all font-extrabold text-center ' +
                (selectedAmount() === amount
                  ? 'border-amber-500 bg-amber-500/20 text-amber-500'
                  : 'border-surface-100 bg-surface-300 text-text-primary hover:border-amber-500/50')
              "
            >
              {{ amount }} 🪙
            </button>
          }
        </div>

        <!-- Custom amount -->
        <div class="flex items-center gap-3">
          <input
            type="number"
            [ngModel]="customAmount()"
            (ngModelChange)="onCustomAmountChange($event)"
            placeholder="Custom amount"
            min="1"
            class="flex-1 bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary text-sm font-bold focus:border-amber-500 focus:outline-none"
          />
          <button
            (click)="selectAmount(customAmount())"
            [disabled]="!customAmount() || customAmount() < 1"
            class="px-4 py-3 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs text-text-secondary disabled:opacity-40"
          >
            {{ 'audioRoom.tipCustom' | t }}
          </button>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button
            (click)="closed.emit()"
            class="px-4 py-2 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs text-text-secondary"
          >
            {{ 'audioRoom.tipCancelBtn' | t }}
          </button>
          <button
            [disabled]="!selectedAmount() || selectedAmount()! < 1 || isSending() || selectedAmount()! > economyStore.coinsBalance()"
            (click)="confirmSend()"
            class="px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-extrabold text-xs shadow transition-all"
          >
            {{
              isSending()
                ? '...'
                : ('audioRoom.tipSendBtn' | t: { amount: selectedAmount() ?? 0 })
            }}
          </button>
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
export class TipHostModalComponent {
  roomId = input.required<string>();
  hostName = input.required<string>();
  closed = output<void>();

  readonly economyStore = inject(EconomyStore);
  private audioRoomsStore = inject(AudioRoomsStore);

  readonly selectedAmount = signal<number | null>(null);
  readonly customAmount = signal<number>(0);
  readonly isSending = signal<boolean>(false);

  readonly presetAmounts = signal<number[]>([10, 50, 100, 500]);

  selectAmount(amount: number): void {
    if (amount >= 1) {
      this.selectedAmount.set(amount);
    }
  }

  onCustomAmountChange(value: number): void {
    this.customAmount.set(value);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  async confirmSend(): Promise<void> {
    const amount = this.selectedAmount();
    if (!amount || amount < 1) return;
    this.isSending.set(true);
    try {
      await this.audioRoomsStore.tipHost(this.roomId(), amount);
      this.closed.emit();
    } finally {
      this.isSending.set(false);
    }
  }
}