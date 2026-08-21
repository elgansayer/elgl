import { HlmButton } from '@spartan-ng/helm/button';
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
  imports: [HlmButton, TranslatePipe],
  template: `
    <div class="max-w-2xl mx-auto p-4">
      <h1 class="text-xl sm:text-2xl font-bold mb-4">{{ 'cart.title' | t }}</h1>
      @if (message()) {
        <p class="mb-4 text-sm text-primary" aria-live="polite">{{ message() }}</p>
      }
      @if (items().length === 0) {
        <p class="text-sm opacity-60" role="status">{{ 'cart.empty' | t }}</p>
      } @else {
        <ul class="space-y-3" role="list">
          @for (item of items(); track item.itemId) {
            <li
              class="flex items-center justify-between rounded-xl bg-surface-200 p-3"
              role="listitem"
            >
              <div>
                <span class="font-medium">{{ item.name }}</span>
                <span class="ms-2 text-xs opacity-50">x{{ item.quantity }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold"
                  >{{ item.unitPrice * item.quantity }} {{ 'common.coins' | t }}</span
                >
                <button
                  hlmBtn
                  class="rounded-full bg-danger px-3 py-1 text-xs font-medium text-on-fill hover:bg-danger/90"
                  (click)="removeItem(item.itemId)"
                  [attr.aria-label]="'cart.removeItem' | t"
                >
                  {{ 'cart.remove' | t }}
                </button>
              </div>
            </li>
          }
        </ul>
        <div class="mt-4 flex items-center justify-between rounded-xl bg-surface-200 p-3">
          <span class="font-semibold">{{ 'cart.total' | t }}</span>
          <span
            class="font-bold text-vip"
            [attr.aria-label]="'cart.totalAria' | t: { total: totalCoins() }"
            >{{ totalCoins() }} {{ 'common.coins' | t }}</span
          >
        </div>
        <button
          hlmBtn
          class="mt-4 w-full rounded-full bg-primary text-on-fill py-2 font-semibold hover:bg-primary/90"
          (click)="checkout()"
          [attr.aria-label]="'cart.checkoutAria' | t"
        >
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
