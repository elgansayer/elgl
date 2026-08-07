import { Component, inject, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { EconomyStore } from '../../services/economy.store';
import { showToast, showErrorToast } from '../../services/toast.service';

interface StickerPack {
  id: string;
  name: string;
  cost_coins: number;
  cover_image_url?: string;
  is_premium?: boolean;
  sticker_count?: number;
}

@Component({
  selector: 'app-sticker-store',
  imports: [TranslatePipe],
  template: `
    <div class="p-4 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
          {{ 'stickerStore.title' | t }}
        </h2>
        <div class="flex items-center gap-2 rounded-full bg-surface-200 px-4 py-2 text-sm font-bold text-amber-400">
          <span aria-hidden="true">🪙</span>
          <span>{{ userCoins() }}</span>
          <span>{{ 'stickerStore.coins' | t }}</span>
        </div>
      </div>

      <!-- Subtitle -->
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
        {{ 'stickerStore.subtitle' | t }}
      </p>

      <!-- Loading state -->
      @if (isLoading()) {
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          @for (i of [0, 1, 2, 3]; track i) {
            <div class="rounded-2xl bg-surface p-4 animate-pulse">
              <div class="w-full aspect-square rounded-xl bg-surface-200 mb-3"></div>
              <div class="h-4 w-3/4 bg-surface-200 rounded mb-2"></div>
              <div class="h-8 w-full bg-surface-200 rounded-full mt-3"></div>
            </div>
          }
        </div>
      }

      <!-- Error state -->
      @if (loadError()) {
        <div class="text-center py-12">
          <p class="text-red-500 mb-4">{{ 'stickerStore.loadError' | t }}</p>
          <button
            class="rounded-full bg-primary px-6 py-2 text-sm font-bold text-white hover:bg-primary/90 transition-colors"
            (click)="loadPacks()"
          >
            {{ 'stickerStore.retry' | t }}
          </button>
        </div>
      }

      <!-- Empty state -->
      @if (!isLoading() && !loadError() && packs().length === 0) {
        <div class="text-center py-12">
          <p class="text-slate-500 dark:text-slate-400">{{ 'stickerStore.empty' | t }}</p>
        </div>
      }

      <!-- Grid of sticker packs -->
      @if (!isLoading() && !loadError() && packs().length > 0) {
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          @for (pack of packs(); track pack.id) {
            <div class="rounded-2xl bg-surface p-4 flex flex-col items-center text-center shadow-sm border border-surface-100 hover:shadow-md transition-shadow">
              <div class="relative w-full aspect-square mb-3">
                <div class="w-full h-full rounded-xl bg-surface-100 flex items-center justify-center overflow-hidden">
                  @if (pack.cover_image_url) {
                    <img
                      [src]="pack.cover_image_url"
                      [alt]="pack.name"
                      class="w-3/4 h-3/4 object-contain drop-shadow-sm"
                      loading="lazy"
                    />
                  } @else {
                    <span class="text-4xl" aria-hidden="true">🎁</span>
                  }
                </div>
                @if (pack.is_premium) {
                  <div class="absolute -top-2 -end-2 rounded-full bg-primary px-2 py-0.5 text-xs font-extrabold text-white shadow">
                    {{ 'stickerStore.vip' | t }}
                  </div>
                }
                @if (pack.sticker_count) {
                  <div class="absolute -bottom-2 -start-2 rounded-full bg-surface-200 px-2 py-0.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {{ pack.sticker_count }}
                  </div>
                }
              </div>

              <h3 class="font-semibold text-slate-700 dark:text-slate-200 mb-1">{{ pack.name }}</h3>

              <button
                class="mt-auto w-full rounded-full bg-primary py-2 text-sm font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                [disabled]="userCoins() < pack.cost_coins"
                (click)="unlockPack(pack)"
              >
                🪙 {{ pack.cost_coins }}
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class StickerStoreComponent {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  readonly i18n = inject(I18nService);
  private readonly economyStore = inject(EconomyStore);
  private baseUrl = `${environment.apiUrl}/economy`;

  readonly userCoins = computed(() => this.economyStore.coinsBalance());
  readonly packs = signal<StickerPack[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly loadError = signal<boolean>(false);

  constructor() {
    this.loadPacks();
  }

  private getHeaders() {
    const token = this.authService.getAccessToken();
    return { Authorization: `Bearer ${token ?? ''}` };
  }

  async loadPacks(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(false);
    try {
      const response = await firstValueFrom(
        this.http.get<StickerPack[]>(`${this.baseUrl}/sticker-packs`, {
          headers: this.getHeaders(),
        }),
      );
      if (Array.isArray(response)) {
        this.packs.set(response);
      } else {
        this.packs.set([]);
      }
    } catch {
      this.loadError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async unlockPack(pack: StickerPack): Promise<void> {
    if (this.userCoins() < pack.cost_coins) {
      showErrorToast(this.i18n.translate('stickerStore.notEnoughCoins'));
      return;
    }
    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean; coins_remaining: number }>(
          `${this.baseUrl}/unlock-sticker-pack`,
          { pack_id: pack.id },
          { headers: this.getHeaders() },
        ),
      );
      if (response.success) {
        this.economyStore.coinsBalance.set(response.coins_remaining);
        showToast(this.i18n.translate('stickerStore.unlockSuccess', { name: pack.name }), 'success');
      }
    } catch {
      showErrorToast(this.i18n.translate('stickerStore.unlockFailed'));
    }
  }
}
