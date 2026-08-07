import { Component, inject, signal, computed, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { AppSkeletonLoaderComponent } from '../primitives/skeleton-loader/skeleton-loader.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-cart',
  imports: [TranslatePipe, AppSkeletonLoaderComponent, AppEmptyStateComponent],
  template: `
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">{{ 'cart.title' | t }}</h1>
      @if (message()) {
        <p class="mb-4 text-sm text-indigo-300">{{ message() }}</p>
      }
      @if (isLoading()) {
        <div class="space-y-3">
          @for (skeleton of skeletons; track skeleton) {
            <div class="rounded-xl bg-surface p-3 flex items-center justify-between">
              <div class="space-y-1 flex-1">
                <app-skeleton-loader height="16px" width="60%" borderRadius="4px" />
                <app-skeleton-loader height="12px" width="30%" borderRadius="4px" />
              </div>
              <app-skeleton-loader height="24px" width="50px" borderRadius="12px" />
            </div>
          }
        </div>
      } @else if (hasError()) {
        <app-empty-state
          icon="⚠️"
          [title]="'cart.errorTitle' | t"
          [description]="'cart.errorDescription' | t"
          [actionLabel]="'cart.retryBtn' | t"
          (actionClicked)="retry()"
        />
      } @else if (items().length === 0) {
        <app-empty-state
          icon="🛒"
          [title]="'cart.emptyTitle' | t"
          [description]="'cart.emptyDescription' | t"
          [actionLabel]="'cart.continueShoppingBtn' | t"
          (actionClicked)="goToShop()"
        />
      } @else {
        <ul class="space-y-3">
          @for (item of items(); track item.itemId) {
            <li class="flex items-center justify-between rounded-xl bg-surface p-3">
              <div>
                <span class="font-medium">{{ item.name }}</span>
                <span class="ms-2 text-xs opacity-50">x{{ item.quantity }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold">{{ item.unitPrice * item.quantity }} {{ 'common.coins' | t }}</span>
                <button
                  class="rounded-full bg-rose-500 px-3 py-1 text-xs font-medium text-white hover:bg-rose-600"
                  (click)="removeItem(item.itemId)"
                  [attr.aria-label]="'cart.removeItem' | t"
                >
                  {{ 'cart.remove' | t }}
                </button>
              </div>
            </li>
          }
        </ul>
        <div class="mt-4 flex items-center justify-between rounded-xl bg-surface p-3">
          <span class="font-semibold">{{ 'cart.total' | t }}</span>
          <span class="font-bold text-indigo-400">{{ totalCoins() }} {{ 'common.coins' | t }}</span>
        </div>
        <button
          class="mt-4 w-full rounded-full bg-indigo-600 py-2 font-semibold hover:bg-indigo-500"
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

  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  message = signal<string>('');
  private reloadCounter = signal(0);
  protected readonly skeletons = [1, 2, 3];

  private cartResource = resource<CartItem[], number>({
    request: () => this.reloadCounter(),
    loader: async () => {
      this.isLoading.set(true);
      this.hasError.set(false);
      try {
        const token = this.authService.getAccessToken();
        return await firstValueFrom(
          this.http.get<CartItem[]>(`${environment.apiUrl}/shopping/cart`, {
            headers: { Authorization: `Bearer ${token ?? ''}` },
          }),
        );
      } catch {
        this.hasError.set(true);
        return [];
      } finally {
        this.isLoading.set(false);
      }
    },
  });

  items = computed<CartItem[]>(() => this.cartResource.value() ?? []);

  totalCoins = computed(() =>
    this.items().reduce((sum: number, item: CartItem) => sum + item.unitPrice * item.quantity, 0),
  );

  retry(): void {
    this.reloadCounter.update((v) => v + 1);
  }

  goToShop(): void {
    window.history.back();
  }

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
      this.reloadCounter.update((v) => v + 1);
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
      this.reloadCounter.update((v) => v + 1);
    } catch {
      this.message.set(this.i18n.translate('cart.checkoutError'));
    }
  }
}
