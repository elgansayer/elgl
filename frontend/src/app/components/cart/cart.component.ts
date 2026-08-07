import { Component, inject, signal, computed, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';

interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-cart',
  imports: [TranslatePipe],
  template: `
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">{{ 'cart.title' | t }}</h1>
      @if (message()) {
        <p class="mb-4 text-sm text-indigo-300">{{ message() }}</p>
      }
      @if (items().length === 0) {
        <p class="text-sm opacity-60">{{ 'cart.empty' | t }}</p>
      } @else {
        <ul class="space-y-3">
          @for (item of items(); track item.itemId) {
            <li class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl bg-[#1e1e1e] p-3">
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-medium text-white truncate">{{ item.name }}</span>
                <span class="text-xs text-neutral-400 shrink-0">x{{ item.quantity }}</span>
              </div>
              <div class="flex items-center justify-between sm:gap-2">
                <span class="text-sm font-semibold text-indigo-400">{{ item.unitPrice * item.quantity }} {{ 'common.coins' | t }}</span>
                <button
                  class="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 active:bg-rose-700 transition-colors"
                  (click)="removeItem(item.itemId)"
                  aria-label="{{ 'cart.removeItem' | t }}"
                >
                  {{ 'cart.remove' | t }}
                </button>
              </div>
            </li>
          }
        </ul>
        <div class="mt-4 flex items-center justify-between rounded-xl bg-[#1e1e1e] p-3">
          <span class="font-semibold text-white">{{ 'cart.total' | t }}</span>
          <span class="font-bold text-indigo-400">{{ totalCoins() }} {{ 'common.coins' | t }}</span>
        </div>
        <button
          class="mt-4 w-full rounded-full bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 active:bg-indigo-700 transition-colors"
          (click)="checkout()">
          {{ 'cart.checkout' | t }}
        </button>
      }
    </div>
  `,
})
export class CartComponent {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private i18n = inject(I18nService);

  private reload = signal(0);
  message = signal<string>('');

  private cartResource = resource<CartItem[], { version: number; token: string | null }>({
    loader: async () => {
      const token = this.authService.getAccessToken();
      return firstValueFrom(
        this.http.get<CartItem[]>(`${environment.apiUrl}/shopping/cart`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        }),
      );
    },
  });

  items = computed<CartItem[]>(() => this.cartResource.value() ?? []);

  totalCoins = computed(() =>
    this.items().reduce((sum: number, item: CartItem) => sum + item.unitPrice * item.quantity, 0),
  );

  async removeItem(itemId: string): Promise<void> {
    const token = this.authService.getAccessToken();
    try {
      await firstValueFrom(
        this.http.delete(`${environment.apiUrl}/shopping/cart`, {
          headers: { Authorization: `Bearer ${token ?? ''}` },
          body: { itemId, quantity: 1 },
        }),
      );
      this.message.set(this.i18n.translate('cart.removeSuccess'));
      this.reload.update((v) => v + 1);
    } catch {
      this.message.set(this.i18n.translate('cart.removeError'));
    }
  }

  async checkout() {
    const token = this.authService.getAccessToken();
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/shopping/cart/checkout`,
          {},
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
      this.message.set(this.i18n.translate('cart.checkoutSuccess'));
      this.reload.update((v) => v + 1);
    } catch {
      this.message.set(this.i18n.translate('cart.checkoutError'));
    }
  }
}
