import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { RouterLink } from '@angular/router';

interface CartItem {
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  template: `
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">{{ 'cart.title' | t }}</h1>
      @if (items().length === 0) {
        <p class="text-sm opacity-60">{{ 'cart.empty' | t }}</p>
      } @else {
        <ul class="space-y-3">
          @for (item of items(); track item.itemId) {
            <li class="flex items-center justify-between rounded-xl bg-surface p-3">
              <div>
                <span class="font-medium">{{ item.name }}</span>
                <span class="ml-2 text-xs opacity-50">x{{ item.quantity }}</span>
              </div>
              <div class="text-sm font-semibold">{{ item.unitPrice * item.quantity }} {{ 'common.coins' | t }}</div>
            </li>
          }
        </ul>
        <button
          class="mt-4 w-full rounded-full bg-indigo-600 py-2 font-semibold hover:bg-indigo-500"
          (click)="checkout()">
          {{ 'cart.checkout' | t }}
        </button>
      }
    </div>
  `,
})
export class CartComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  items = signal<CartItem[]>([]);

  ngOnInit() {
    this.loadCart();
  }

  async loadCart() {
    const token = this.authService.getAccessToken();
    this.http.get<CartItem[]>(`${environment.apiUrl}/cart`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    }).subscribe({
      next: (data) => this.items.set(data),
      error: () => this.items.set([]),
    });
  }

  async checkout() {
    const token = this.authService.getAccessToken();
    this.http.post(`${environment.apiUrl}/cart/checkout`, {}, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    }).subscribe({
      next: () => {
        alert('Checkout successful!');
        this.loadCart();
      },
      error: () => alert('Checkout failed.'),
    });
  }
}
