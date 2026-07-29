import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { showToast, showErrorToast } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { AppCardComponent } from '../primitives/card/card.component';
import { AppButtonSecondaryComponent } from '../primitives/button-secondary/button-secondary.component';
import { AppPillComponent } from '../primitives/pill/pill.component';

export interface Sticker {
  id: string;
  name: string;
  imageUrl: string;
  coinPrice: number;
  isPremium: boolean;
}

@Component({
  selector: 'app-sticker-store',
  imports: [CommonModule, AppCardComponent, AppButtonSecondaryComponent, AppPillComponent],
  templateUrl: './sticker-store.component.html',
})
export class StickerStoreComponent {
  private readonly i18n = inject(I18nService);

  readonly stickers = signal<Sticker[]>([
    {
      id: 'stk_1',
      name: 'Happy Corgi',
      imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Corgi',
      coinPrice: 50,
      isPremium: false,
    },
    {
      id: 'stk_2',
      name: 'Golden Dragon',
      imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Dragon',
      coinPrice: 500,
      isPremium: true,
    },
    {
      id: 'stk_3',
      name: 'Study Owl',
      imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Owl',
      coinPrice: 100,
      isPremium: false,
    },
    {
      id: 'stk_4',
      name: 'Party Parrot',
      imageUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Parrot',
      coinPrice: 150,
      isPremium: false,
    },
  ]);

  readonly userCoins = signal<number>(200); // Mock user balance

  purchaseSticker(sticker: Sticker): void {
    if (this.userCoins() >= sticker.coinPrice) {
      this.userCoins.update((coins) => coins - sticker.coinPrice);
      showToast(this.i18n.translate('sticker.purchaseSuccess', { name: sticker.name }), 'success');
    } else {
      showErrorToast(this.i18n.translate('sticker.notEnoughCoins'));
    }
  }
}
