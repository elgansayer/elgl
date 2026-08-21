import { Component, input, output, inject, computed } from '@angular/core';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDialogImports, type HlmDialogState } from '@spartan-ng/helm/dialog';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { EconomyStore } from '../../services/economy.store';

@Component({
  selector: 'app-sticker-picker',
  imports: [TranslatePipe, ...HlmButtonImports, ...HlmDialogImports],
  template: `
    <hlm-dialog [state]="dialogState()" (stateChanged)="onDialogStateChanged($event)">
      <hlm-dialog-content
        *hlmDialogPortal
        [showCloseButton]="false"
        class="max-h-[50vh] w-full overflow-y-auto rounded-t-2xl border border-surface-100 bg-surface-200 p-0 shadow-xl sm:max-w-lg sm:rounded-2xl"
      >
        <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3">
          <h3 class="text-sm font-semibold text-text-primary">{{ 'chatRoom.stickersDrawerTitle' | t }}</h3>
          <button hlmBtn type="button" variant="ghost" size="icon-touch" (click)="dismiss.emit()" [attr.aria-label]="'common.close' | t">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4">
          <div class="mb-4">
            <h4 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ 'stickerStore.defaultStickers' | t }}</h4>
            <div class="grid grid-cols-4 gap-3">
              @for (sticker of defaultStickers; track sticker.id) {
                <button
                  hlmBtn
                  type="button"
                  variant="ghost"
                  class="aspect-square h-auto rounded-xl p-2"
                  (click)="onSelectSticker(sticker.url)"
                  [attr.aria-label]="sticker.name"
                  [title]="sticker.name"
                >
                  <img [src]="sticker.url" alt="" class="h-full w-full object-contain drop-shadow-sm transition-transform hover:scale-110" loading="lazy" />
                </button>
              }
            </div>
          </div>

          @for (pack of unlockedPacks(); track pack.id) {
            <div class="mb-4">
              <div class="mb-2 flex items-center gap-2">
                <h4 class="text-xs font-semibold uppercase tracking-wide text-text-secondary">{{ pack.name }}</h4>
                @if (pack.is_animated) {
                  <span class="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-on-fill">{{ 'stickerStore.animatedBadge' | t }}</span>
                }
              </div>
              <div class="grid grid-cols-4 gap-3">
                @for (sticker of getPackStickers(pack); track sticker.id) {
                  <button
                    hlmBtn
                    type="button"
                    variant="ghost"
                    class="aspect-square h-auto rounded-xl p-2"
                    (click)="onSelectSticker(sticker.url)"
                    [attr.aria-label]="pack.name"
                    [title]="sticker.url.split('/').pop() ?? ''"
                  >
                    @if (sticker.is_animated) {
                      <video [src]="sticker.url" autoplay loop muted playsinline class="h-full w-full object-contain drop-shadow-sm"></video>
                    } @else {
                      <img [src]="sticker.url" alt="" class="h-full w-full object-contain drop-shadow-sm transition-transform hover:scale-110" loading="lazy" />
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </hlm-dialog-content>
    </hlm-dialog>
  `,
})
export class StickerPickerComponent {
  private readonly economyStore = inject(EconomyStore);
  private readonly i18n = inject(I18nService);

  readonly isOpen = input<boolean>(false);
  readonly selectSticker = output<string>();
  readonly dismiss = output<void>();
  readonly dialogState = computed<HlmDialogState>(() => this.isOpen() ? 'open' : 'closed');

  readonly defaultStickers = [
    { id: 'default_happy', url: 'assets/stickers/happy.png', name: 'Happy', is_animated: false },
    { id: 'default_laugh', url: 'assets/stickers/laugh.png', name: 'Laugh', is_animated: false },
    { id: 'default_love', url: 'assets/stickers/love.png', name: 'Love', is_animated: false },
    { id: 'default_thumbs', url: 'assets/stickers/thumbs-up.png', name: 'Thumbs Up', is_animated: false },
    { id: 'default_sad', url: 'assets/stickers/sad.png', name: 'Sad', is_animated: false },
    { id: 'default_confused', url: 'assets/stickers/confused.png', name: 'Confused', is_animated: false },
    { id: 'default_sleepy', url: 'assets/stickers/sleepy.png', name: 'Sleepy', is_animated: false },
    { id: 'default_angry', url: 'assets/stickers/angry.png', name: 'Angry', is_animated: false },
  ];

  readonly unlockedPacks = computed(() => this.economyStore.unlockedStickerPacks());

  onDialogStateChanged(state: HlmDialogState): void {
    if (state === 'closed' && this.isOpen()) this.dismiss.emit();
  }

  getPackStickers(pack: { id: string; name: string; sticker_urls?: string[]; is_animated?: boolean }): { id: string; url: string; is_animated: boolean }[] {
    if (!pack.sticker_urls?.length) return [];
    return pack.sticker_urls.map((url, index) => ({
      id: `${pack.id}_${index}`,
      url,
      is_animated: pack.is_animated ?? (url.endsWith('.webm') || url.endsWith('.json')),
    }));
  }

  onSelectSticker(url: string): void {
    this.selectSticker.emit(url);
    this.dismiss.emit();
  }
}
