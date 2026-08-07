<<<<<<< HEAD
import { Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';

@Component({
  selector: 'app-sticker-picker',
  imports: [RouterLink, TranslatePipe],
  template: `
    <!-- Backdrop -->
    @if (isOpen()) {
      <div
        class="fixed inset-0 z-40 bg-black/50 transition-opacity"
        (click)="closePicker.emit()"
        (keydown.enter)="closePicker.emit()"
        tabindex="0"
        role="button"
      ></div>
    }

    <!-- Drawer -->
    <div
      class="fixed bottom-0 start-0 end-0 z-50 flex flex-col bg-[#1E1E1E] rounded-t-2xl shadow-xl transition-transform duration-300 ease-in-out transform"
      [class.translate-y-0]="isOpen()"
      [class.translate-y-full]="!isOpen()"
      style="max-height: 55vh;"
=======
import { Component, input, output, inject, computed } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { EconomyStore } from '../../services/economy.store';

@Component({
  selector: 'app-sticker-picker',
  imports: [TranslatePipe],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-40 bg-black/20 transition-opacity"
      (click)="close.emit()"
      (keydown.enter)="close.emit()"
      tabindex="0"
      role="button"
    ></div>

    <!-- Drawer -->
    <div
      class="fixed bottom-0 start-0 end-0 z-50 flex flex-col bg-white dark:bg-slate-800 rounded-t-2xl shadow-xl transition-transform duration-300 ease-in-out transform"
      style="max-height: 50vh;"
>>>>>>> origin/main
    >
      <!-- Handle -->
      <div
        class="flex justify-center pt-3 pb-2 cursor-pointer"
        (click)="close.emit()"
        (keydown.enter)="close.emit()"
        tabindex="0"
        role="button"
        [attr.aria-label]="'common.close' | t"
      >
        <div class="w-12 h-1.5 bg-neutral-600 rounded-full"></div>
      </div>

      <!-- Header -->
<<<<<<< HEAD
      <div class="px-4 pb-2 border-b border-neutral-700 flex justify-between items-center">
        <h3 class="text-sm font-semibold text-white">{{ 'sticker.pickerTitle' | t }}</h3>
        <a
          routerLink="/sticker-store"
          class="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:from-indigo-500 hover:to-violet-500"
          [attr.aria-label]="'stickerStore.title' | t"
        >
          {{ 'sticker.openStore' | t }}
        </a>
=======
      <div
        class="px-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center"
      >
        <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ 'chatRoom.stickersDrawerTitle' | t }}</h3>
>>>>>>> origin/main
      </div>

      <!-- Sticker Packs (tab-style) -->
      <div class="flex-1 overflow-y-auto p-4">
<<<<<<< HEAD
        <div class="grid grid-cols-4 gap-4">
          @for (sticker of stickers(); track sticker.id) {
            <button
              (click)="onSelectSticker(sticker.url)"
              class="aspect-square p-2 rounded-xl hover:bg-neutral-700 transition-colors flex items-center justify-center focus:outline-none"
              [attr.aria-label]="sticker.name"
            >
              <img
                [src]="sticker.url"
                [alt]="sticker.name"
                class="w-full h-full object-contain drop-shadow-sm hover:scale-110 transition-transform"
                loading="lazy"
              />
            </button>
          }
=======
        <!-- Default free stickers -->
        <div class="mb-4">
          <h4 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">{{ 'stickerStore.defaultStickers' | t }}</h4>
          <div class="grid grid-cols-4 gap-3">
            @for (sticker of defaultStickers; track sticker.id) {
              <button
                (click)="onSelectSticker(sticker.url)"
                class="aspect-square p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center focus:outline-none"
                [title]="sticker.name"
              >
                <img
                  [src]="sticker.url"
                  [alt]="sticker.name"
                  class="w-full h-full object-contain drop-shadow-sm hover:scale-110 transition-transform"
                  loading="lazy"
                />
              </button>
            }
          </div>
>>>>>>> origin/main
        </div>

        @if (unlockedPacks().length > 0) {
          @for (pack of unlockedPacks(); track pack.id) {
            <div class="mb-4">
              <div class="flex items-center gap-2 mb-2">
                <h4 class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{{ pack.name }}</h4>
                @if (pack.is_animated) {
                  <span class="rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs font-bold text-white">{{ 'stickerStore.animatedBadge' | t }}</span>
                }
              </div>
              <div class="grid grid-cols-4 gap-3">
                @for (sticker of getPackStickers(pack); track sticker.id) {
                  <button
                    (click)="onSelectSticker(sticker.url)"
                    class="aspect-square p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center focus:outline-none"
                    [title]="sticker.url.split('/').pop() ?? ''"
                  >
                    @if (sticker.is_animated) {
                      <video
                        [src]="sticker.url"
                        autoplay
                        loop
                        muted
                        playsinline
                        class="w-full h-full object-contain drop-shadow-sm hover:scale-110 transition-transform"
                      ></video>
                    } @else {
                      <img
                        [src]="sticker.url"
                        [alt]="pack.name"
                        class="w-full h-full object-contain drop-shadow-sm hover:scale-110 transition-transform"
                        loading="lazy"
                      />
                    }
                  </button>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class StickerPickerComponent {
  private readonly economyStore = inject(EconomyStore);
  private readonly i18n = inject(I18nService);

  readonly isOpen = input<boolean>(false);
  readonly selectSticker = output<string>();
  readonly close = output<void>();

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

  getPackStickers(pack: { id: string; name: string; sticker_urls?: string[]; is_animated?: boolean }): { id: string; url: string; is_animated: boolean }[] {
    if (!pack.sticker_urls || pack.sticker_urls.length === 0) {
      return [];
    }
    return pack.sticker_urls.map((url, i) => ({
      id: `${pack.id}_${i}`,
      url,
      is_animated: pack.is_animated ?? (url.endsWith('.webm') || url.endsWith('.json')),
    }));
  }

  onSelectSticker(url: string): void {
    this.selectSticker.emit(url);
    this.close.emit();
  }
}
