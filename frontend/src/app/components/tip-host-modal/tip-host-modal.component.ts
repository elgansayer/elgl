import { HlmInput } from '@spartan-ng/helm/input';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { Component, input, output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';
import { AudioRoomsStore } from '../../services/audio-rooms.store';
import { EconomyStore } from '../../services/economy.store';

@Component({
  selector: 'app-tip-host-modal',
  imports: [HlmInput, HlmButton, TranslatePipe, FormsModule, ...HlmDialogImports],
  template: `
    <hlm-dialog state="open" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="max-h-[calc(100dvh-2rem)] w-[calc(100%-1rem)] max-w-md space-y-4 overflow-y-auto rounded-sheet border border-surface-100 bg-surface-200 p-4 shadow-lift sm:w-[calc(100%-2rem)] sm:space-y-5 sm:p-6"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="subtitleId"
      >
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-surface-100 pb-3">
          <div>
            <h3 [id]="titleId" class="text-xl font-black text-text-primary">
              {{ 'audioRoom.tipModalTitle' | t }}
            </h3>
            <p [id]="subtitleId" class="text-xs text-text-secondary">
              {{ 'audioRoom.tipModalSubtitle' | t }}
            </p>
          </div>
          <button
            hlmBtn
            hlmDialogClose
            type="button"
            variant="ghost"
            size="icon-touch"
            [disabled]="isSending()"
            [attr.aria-label]="'common.close' | t"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <!-- Balance -->
        <div
          class="bg-vip/10 p-4 rounded-2xl border border-vip/30 flex items-center justify-between"
        >
          <div class="flex items-center gap-2">
            <span class="text-2xl" aria-hidden="true">💰</span>
            <div>
              <span class="text-[10px] uppercase font-black text-vip block">{{
                'audioRoom.tipBalanceLabel' | t
              }}</span>
              <span class="text-lg font-extrabold text-vip" aria-live="polite"
                >{{ economyStore.coinsBalance() }} 🪙</span
              >
            </div>
          </div>
        </div>

        <!-- Preset amounts -->
        <fieldset>
          <legend class="sr-only">{{ 'audioRoom.tipPresetLabel' | t }}</legend>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            @for (amount of presetAmounts(); track amount) {
              <button
                hlmBtn
                type="button"
                (click)="selectAmount(amount)"
                [class]="
                  'p-3 sm:p-4 rounded-2xl border-2 transition-all font-extrabold text-center text-sm sm:text-base ' +
                  (selectedAmount() === amount
                    ? 'border-vip bg-vip/20 text-vip'
                    : 'border-surface-100 bg-surface-300 text-text-primary hover:border-vip/50')
                "
                [attr.aria-label]="'audioRoom.tipAmountAria' | t: { amount: amount }"
                [attr.aria-pressed]="selectedAmount() === amount"
              >
                {{ amount }} 🪙
              </button>
            }
          </div>
        </fieldset>

        <!-- Custom amount -->
        <div class="flex items-center gap-3">
          <label [for]="customAmountId" class="sr-only">{{
            'audioRoom.tipCustomAmountLabel' | t
          }}</label>
          <input
            hlmInput
            [id]="customAmountId"
            type="number"
            [ngModel]="customAmount()"
            (ngModelChange)="onCustomAmountChange($event)"
            [placeholder]="'audioRoom.tipCustomPlaceholder' | t"
            min="1"
            class="flex-1 bg-surface-300 border border-surface-100 rounded-xl px-4 py-3 text-text-primary text-sm font-bold focus:border-vip focus:outline-none"
          />
          <button
            hlmBtn
            type="button"
            (click)="selectAmount(customAmount())"
            [disabled]="!customAmount() || customAmount() < 1"
            class="px-4 py-3 bg-surface-100 hover:bg-surface-100 rounded-xl font-bold text-xs text-text-secondary disabled:opacity-40"
            [attr.aria-label]="'audioRoom.tipCustomAria' | t: { amount: customAmount() }"
          >
            {{ 'audioRoom.tipCustom' | t }}
          </button>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-2 border-t border-surface-100">
          <button
            hlmBtn
            hlmDialogClose
            type="button"
            variant="secondary"
            size="touch"
            [disabled]="isSending()"
          >
            {{ 'audioRoom.tipCancelBtn' | t }}
          </button>
          <button
            hlmBtn
            type="button"
            size="touch"
            [disabled]="
              !selectedAmount() ||
              selectedAmount()! < 1 ||
              isSending() ||
              selectedAmount()! > economyStore.coinsBalance()
            "
            (click)="confirmSend()"
            class="px-6 py-2 bg-vip hover:bg-vip/90 disabled:opacity-50 text-on-fill rounded-xl font-extrabold text-xs shadow transition-all"
            [attr.aria-label]="'audioRoom.tipSendAria' | t: { amount: selectedAmount() ?? 0 }"
          >
            {{
              isSending()
                ? ('audioRoom.tipSending' | t)
                : ('audioRoom.tipSendBtn' | t: { amount: selectedAmount() ?? 0 })
            }}
          </button>
        </div>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
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
  private readonly pendingIdempotencyKey = signal<string | null>(null);

  readonly presetAmounts = signal<number[]>([10, 50, 100, 500]);

  readonly titleId = 'tip-host-title-' + crypto.randomUUID();
  readonly subtitleId = 'tip-host-subtitle-' + crypto.randomUUID();
  readonly customAmountId = 'tip-host-custom-' + crypto.randomUUID();

  selectAmount(amount: number): void {
    if (amount >= 1) {
      if (this.selectedAmount() !== amount) this.pendingIdempotencyKey.set(null);
      this.selectedAmount.set(amount);
    }
  }

  onCustomAmountChange(value: number): void {
    this.customAmount.set(value);
  }

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && !this.isSending()) this.closed.emit();
  }

  async confirmSend(): Promise<void> {
    const amount = this.selectedAmount();
    if (!amount || amount < 1) return;
    const idempotencyKey = this.pendingIdempotencyKey() ?? crypto.randomUUID();
    this.pendingIdempotencyKey.set(idempotencyKey);
    this.isSending.set(true);
    try {
      const sent = await this.audioRoomsStore.tipHost(this.roomId(), amount, idempotencyKey);
      if (sent) this.closed.emit();
    } finally {
      this.isSending.set(false);
    }
  }
}
