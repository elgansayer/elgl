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
    >
      <!-- Handle -->
      <div
        class="flex justify-center pt-3 pb-2 cursor-pointer"
        (click)="closePicker.emit()"
        (keydown.enter)="closePicker.emit()"
        tabindex="0"
        role="button"
        [attr.aria-label]="'common.close' | t"
      >
        <div class="w-12 h-1.5 bg-neutral-600 rounded-full"></div>
      </div>

      <!-- Header -->
      <div class="px-4 pb-2 border-b border-neutral-700 flex justify-between items-center">
        <h3 class="text-sm font-semibold text-white">{{ 'sticker.pickerTitle' | t }}</h3>
        <a
          routerLink="/sticker-store"
          class="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:from-indigo-500 hover:to-violet-500"
          [attr.aria-label]="'stickerStore.title' | t"
        >
          {{ 'sticker.openStore' | t }}
        </a>
      </div>

      <!-- Sticker Grid -->
      <div class="flex-1 overflow-y-auto p-4">
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
        </div>
      </div>
    </div>
  `,
})
export class StickerPickerComponent {
  readonly isOpen = input<boolean>(false);
  readonly selectSticker = output<string>();
  readonly closePicker = output<void>();

  // Mock stickers - replace with actual R2 URLs or asset paths
  readonly stickers = signal([
    { id: '1', name: 'Happy', url: 'assets/stickers/happy.png' },
    { id: '2', name: 'Sad', url: 'assets/stickers/sad.png' },
    { id: '3', name: 'Love', url: 'assets/stickers/love.png' },
    { id: '4', name: 'Laugh', url: 'assets/stickers/laugh.png' },
    { id: '5', name: 'Thumbs Up', url: 'assets/stickers/thumbs-up.png' },
    { id: '6', name: 'Confused', url: 'assets/stickers/confused.png' },
    { id: '7', name: 'Sleepy', url: 'assets/stickers/sleepy.png' },
    { id: '8', name: 'Angry', url: 'assets/stickers/angry.png' },
  ]);

  onSelectSticker(url: string): void {
    this.selectSticker.emit(url);
    this.closePicker.emit();
  }
}
