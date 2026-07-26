import { Component, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sticker-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="sticker-drawer bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 h-64 overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-sm font-semibold text-slate-700 dark:text-slate-300">Stickers</h3>
        <button (click)="closePicker.emit()" class="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          ✕
        </button>
      </div>
      <div class="grid grid-cols-4 gap-4">
        @for (sticker of stickers(); track sticker.id) {
          <button 
            (click)="selectSticker.emit(sticker.url)"
            class="hover:scale-110 transition-transform duration-200 focus:outline-none">
            <img [src]="sticker.url" [alt]="sticker.name" class="w-full h-auto object-contain" />
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `]
})
export class StickerPickerComponent {
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
}
