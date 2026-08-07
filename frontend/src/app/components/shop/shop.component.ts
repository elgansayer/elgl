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
      <a routerLink="/cart" class="mb-6 inline-block text-sm font-medium text-indigo-400 underline focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded">{{ 'cart.title' | t }}</a>
      @if (message()) {
        <p class="mb-4 text-sm text-indigo-300" role="status" aria-live="polite">{{ message() }}</p>
      }
      @if (catalogResource.isLoading()) {
        <div class="flex items-center justify-center py-10" role="status">
          <div class="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent"></div>
          <span class="ms-3 text-neutral-400">{{ 'common.loading' | t }}</span>
        </div>
      }
      <div class="grid grid-cols-2 gap-4">
        @for (item of items(); track item.id) {
          <div class="rounded-xl bg-surface p-3 shadow" role="article" [attr.aria-label]="item.name">
            <div class="h-20 w-full rounded-lg bg-neutral-700 mb-2 flex items-center justify-center text-3xl" aria-hidden="true">
              {{ item.imageUrl ? '' : '🎁' }}
            </div>
            <h2 class="font-semibold">{{ item.name }}</h2>
            <p class="text-xs opacity-60">{{ item.description }}</p>
            <p class="mt-1 font-semibold text-indigo-400">
              {{ item.price }} {{ 'common.coins' | t: { currency: 'coins' } }}
            </p>
            <button
              class="mt-2 w-full rounded-full bg-indigo-600 py-1 text-sm font-medium hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              (click)="addToCart(item.id)"
              [attr.aria-label]="'cart.addAria' | t: { name: item.name }">
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

  catalogResource = resource<CatalogItem[], number>({
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
