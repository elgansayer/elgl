import { Component, inject, signal, computed, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
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
  imports: [TranslatePipe, RouterLink],
  template: `
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">{{ 'shop.title' | t }}</h1>
      <p class="mb-6 text-sm opacity-70">{{ 'shop.subtitle' | t }}</p>
      <a routerLink="/cart" class="mb-6 block text-sm font-medium text-indigo-400 underline">{{ 'cart.title' | t }}</a>
      @if (message()) {
        <p class="mb-4 text-sm text-indigo-300">{{ message() }}</p>
      }
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
        @for (item of items(); track item.id) {
          <div class="rounded-xl bg-[#1e1e1e] p-3 shadow flex flex-col">
            <div class="h-24 w-full rounded-lg bg-neutral-700 mb-2 flex items-center justify-center text-3xl shrink-0">
              {{ item.imageUrl ? '' : '🎁' }}
            </div>
            <h2 class="font-semibold text-white text-sm truncate">{{ item.name }}</h2>
            <p class="text-xs text-neutral-400 line-clamp-2 mb-1">{{ item.description }}</p>
            <p class="mt-auto font-semibold text-indigo-400 text-sm">
              {{ item.price }} {{ 'common.coins' | t: { currency: 'coins' } }}
            </p>
            <button
              class="mt-2 w-full rounded-full bg-indigo-600 py-2 text-xs font-medium hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
              (click)="addToCart(item.id)">
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
        this.http.get<CatalogItem[]>(
          `${environment.apiUrl}/shopping/catalog`,
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
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
