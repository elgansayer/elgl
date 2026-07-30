import { Component, input, output, signal } from '@angular/core';

interface Sticker {
  id: string;
  emoji: string;
}

@Component({
  selector: 'app-sticker-picker',
  standalone: true,
  template: `
    @if (isOpen()) {
      <div class="fixed inset-0 z-50 bg-black/50" (click)="closeDrawer()">
        <div
          class="fixed bottom-0 start-0 end-0 bg-neutral-900 rounded-t-2xl p-4 shadow-2xl max-h-80 overflow-y-auto"
          (click)="$event.stopPropagation()"
        >
          <div class="grid grid-cols-4 gap-4">
            @for (sticker of stickers(); track sticker.id) {
              <button
                type="button"
                (click)="onSelect(sticker)"
                class="flex items-center justify-center w-16 h-16 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors"
              >
                <span class="text-3xl">{{ sticker.emoji }}</span>
              </button>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class StickerPickerComponent {
  readonly isOpen = input(false);
  readonly stickerSelected = output<Sticker>();
  readonly close = output<void>();

  protected readonly stickers = signal<Sticker[]>([
    { id: 'grinning', emoji: '😀' },
    { id: 'heart_eyes', emoji: '😍' },
    { id: 'thumbs_up', emoji: '👍' },
    { id: 'fire', emoji: '🔥' },
    { id: 'clap', emoji: '👏' },
    { id: 'party_popper', emoji: '🎉' },
    { id: 'crying', emoji: '😢' },
    { id: 'pray', emoji: '🙏' },
    { id: 'face_with_tears', emoji: '😂' },
    { id: 'smiling_face_with_heart', emoji: '🥰' },
    { id: 'winking', emoji: '😉' },
    { id: 'sunglasses', emoji: '😎' },
  ]);

  closeDrawer(): void {
    this.close.emit();
  }

  onSelect(sticker: Sticker): void {
    this.stickerSelected.emit(sticker);
    this.close.emit();
  }
}
