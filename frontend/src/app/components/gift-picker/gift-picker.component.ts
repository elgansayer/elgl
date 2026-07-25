import { Component, output, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../services/translate.pipe';

interface GiftItem {
  id: string;
  name: string;
  emoji: string;
  coinCost: number;
  category: string;
}

const AVAILABLE_GIFTS: GiftItem[] = [
  { id: 'rose', name: 'Rose', emoji: '🌹', coinCost: 10, category: 'romantic' },
  { id: 'heart', name: 'Heart', emoji: '❤️', coinCost: 5, category: 'romantic' },
  { id: 'cake', name: 'Cake', emoji: '🎂', coinCost: 20, category: 'celebration' },
  { id: 'fire', name: 'Fire', emoji: '🔥', coinCost: 15, category: 'cool' },
  { id: 'star', name: 'Star', emoji: '⭐', coinCost: 8, category: 'cool' },
  { id: 'clap', name: 'Clap', emoji: '👏', coinCost: 3, category: 'reaction' },
  { id: 'thumbsup', name: 'Thumbs Up', emoji: '👍', coinCost: 2, category: 'reaction' },
  { id: 'crown', name: 'Crown', emoji: '👑', coinCost: 50, category: 'premium' },
  { id: 'diamond', name: 'Diamond', emoji: '💎', coinCost: 100, category: 'premium' },
  { id: 'unicorn', name: 'Unicorn', emoji: '🦄', coinCost: 30, category: 'fun' },
  { id: 'rocket', name: 'Rocket', emoji: '🚀', coinCost: 25, category: 'fun' },
  { id: 'giftbox', name: 'Gift Box', emoji: '🎁', coinCost: 15, category: 'celebration' },
];

@Component({
  selector: 'app-gift-picker',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div
      class="bg-surface-200 border border-surface-100 rounded-xl shadow-2xl w-72 max-h-96 overflow-hidden"
    >
      <!-- Header -->
      <div class="p-3 border-b border-surface-100">
        <h3 class="text-sm font-semibold text-white">{{ 'giftPicker.title' | t }}</h3>
      </div>

      <!-- Category filter -->
      <div class="flex gap-1 p-2 border-b border-surface-100 overflow-x-auto">
        @for (cat of categories; track cat) {
          <button
            (click)="selectedCategory.set(cat)"
            [class]="
              selectedCategory() === cat
                ? 'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors bg-pink-600 text-white'
                : 'px-2 py-1 text-xs rounded-full whitespace-nowrap transition-colors bg-surface-100 text-text-secondary hover:bg-gray-600'
            "
          >
            {{ cat }}
          </button>
        }
      </div>

      <!-- Gift grid -->
      <div class="overflow-y-auto max-h-64 p-2">
        <div class="grid grid-cols-3 gap-2">
          @for (gift of filteredGifts(); track gift) {
            <button
              (click)="selectGift(gift)"
              class="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-surface-100 transition-colors"
              [attr.aria-label]="'Send ' + gift.name"
            >
              <span class="text-2xl">{{ gift.emoji }}</span>
              <span class="text-xs text-text-secondary">{{ gift.name }}</span>
              <span class="text-[10px] text-yellow-400">{{ gift.coinCost }} 🪙</span>
            </button>
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
export class GiftPickerComponent {
  onGiftSelect = output<string>();

  gifts = AVAILABLE_GIFTS;
  selectedCategory = signal('All');

  readonly categories = ['All', ...new Set(this.gifts.map((g) => g.category))];

  readonly filteredGifts = () => {
    const cat = this.selectedCategory();
    if (cat === 'All') return this.gifts;
    return this.gifts.filter((g) => g.category === cat);
  };

  selectGift(gift: GiftItem): void {
    this.onGiftSelect.emit(gift.id);
  }
}
