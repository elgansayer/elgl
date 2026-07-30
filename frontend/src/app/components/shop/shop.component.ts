import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { RouterLink } from '@angular/router';

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
      <div class="grid grid-cols-2 gap-4">
        @for (item of items(); track item.id) {
          <div class="rounded-xl bg-surface p-3 shadow">
            <div class="h-20 w-full rounded-lg bg-neutral-700 mb-2 flex items-center justify-center text-3xl">
              {{ item.imageUrl ? '' : '🎁' }}
            </div>
            <h2 class="font-semibold">{{ item.name }}</h2>
            <p class="text-xs opacity-60">{{ item.description }}</p>
            <p class="mt-1 font-semibold text-indigo-400">{{ item.price }} {{ 'common.coins' | t }}</p>
            <button
              class="mt-2 w-full rounded-full bg-indigo-600 py-1 text-sm font-medium hover:bg-indigo-500"
              (click)="addToCart(item.id)">
              {{ 'cart.add' | t }}
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class ShopComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  items = signal<CatalogItem[]>([]);

  ngOnInit() {
    const token = this.authService.getAccessToken();
    this.http.get<CatalogItem[]>(`${environment.apiUrl}/shopping/catalog`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    }).subscribe({
      next: (data) => this.items.set(data),
      error: () => this.items.set([]),
    });
  }

  async addToCart(itemId: string) {
    const token = this.authService.getAccessToken();
    this.http.post(`${environment.apiUrl}/cart/add`, { itemId }, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    }).subscribe({
      next: () => alert('Added to cart!'),
      error: () => alert('Failed to add.'),
    });
  }
}
