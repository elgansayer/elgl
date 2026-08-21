import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { JoyrideModule } from 'ngx-joyride';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface CatalogItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
}

@Component({
  selector: 'app-shop',
  standalone: true,
  imports: [HlmButton, JoyrideModule, TranslatePipe, RouterLink],
  template: `
    <div class="max-w-6xl mx-auto p-4">
      <h1 class="text-xl font-bold mb-4">{{ 'shop.title' | t }}</h1>
      <p class="mb-6 text-sm opacity-70">{{ 'shop.subtitle' | t }}</p>
      <span
        joyrideStep="economyTour@shopLink"
        [text]="'tour.shopLinkDesc' | t"
        stepPosition="bottom"
      >
        <a routerLink="/cart" class="mb-6 block text-sm font-medium text-primary underline">{{
          'cart.title' | t
        }}</a>
      </span>
      @if (message()) {
        <p class="mb-4 text-sm text-primary" aria-live="polite">{{ message() }}</p>
      }
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4" role="list">
        @for (item of items(); track item.id) {
          <div class="rounded-xl bg-surface-200 p-3 shadow flex flex-col" role="listitem">
            <div
              class="h-24 sm:h-28 w-full rounded-lg bg-surface-400 mb-2 flex items-center justify-center text-3xl sm:text-4xl"
              aria-hidden="true"
            >
              {{ item.imageUrl ? '' : '🎁' }}
            </div>
            <h2 class="font-semibold text-sm sm:text-base truncate">{{ item.name }}</h2>
            <p class="text-xs opacity-60 line-clamp-2">{{ item.description }}</p>
            <p
              class="mt-auto pt-1 font-semibold text-vip text-sm sm:text-base"
              [attr.aria-label]="'shop.priceAria' | t: { price: item.price, name: item.name }"
            >
              {{ item.price }} {{ 'common.coins' | t: { currency: 'coins' } }}
            </p>
            <button
              hlmBtn
              class="mt-2 w-full rounded-full bg-primary text-on-fill py-1.5 text-xs sm:text-sm font-medium hover:bg-primary/90 transition-colors"
              (click)="addToCart(item.id)"
              [attr.aria-label]="'shop.addToCartAria' | t: { name: item.name }"
            >
              {{ 'cart.add' | t }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class ShopComponent {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private i18n = inject(I18nService);

  private reload = signal(0);
  message = signal<string>('');

  private catalogResource = resource<CatalogItem[], number>({
    loader: async () => {
      const token = this.authService.getAccessToken();
      const response = await firstValueFrom(
        this.http.get<CatalogItem[]>(`${environment.apiUrl}/shopping/catalog`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        }),
      );
      if (!Array.isArray(response)) {
        throw new Error('Invalid catalog response');
      }
      return response.map((item) => ({
        id: String(item.id),
        name: String(item.name),
        description: String(item.description),
        price: Number(item.price),
        imageUrl: item.imageUrl ? String(item.imageUrl) : undefined,
      }));
    },
  });

  items = computed(() => this.catalogResource.value() ?? []);

  async addToCart(itemId: string) {
    const token = this.authService.getAccessToken();
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean }>(
          `${environment.apiUrl}/shopping/cart`,
          { itemId },
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
      if (!response.success) {
        throw new Error('Failed to add item to cart');
      }
      this.message.set(this.i18n.translate('cart.addSuccess'));
      this.reload.update((v) => v + 1);
    } catch {
      this.message.set(this.i18n.translate('cart.addError', { itemId }));
    }
  }
}
