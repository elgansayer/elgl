import { Component, inject, signal, computed, resource } from '@angular/core';
import { JoyrideModule } from 'ngx-joyride';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { EconomyStore, StickerPack } from '../../services/economy.store';
import { AppCardComponent } from '../primitives/card/card.component';

import { AppPillComponent } from '../primitives/pill/pill.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-sticker-store',
  imports: [
    JoyrideModule,
    TranslatePipe,
    AppCardComponent,
    AppPillComponent,
    AppEmptyStateComponent,
  ],
  template: `<div class="min-h-screen bg-[#121212]">
  <!-- Header -->
  <div class="flex items-center justify-between px-4 pt-4 pb-2">
    <div>
      <span joyrideStep="economyTour@stickerStore" [text]="'tour.stickerStoreDesc' | t" stepPosition="bottom">
        <h1 class="text-2xl font-bold text-white">{{ 'stickerStore.title' | t }}</h1>
      </span>
      <p class="text-sm text-neutral-400 mt-1">{{ 'stickerStore.subtitle' | t }}</p>
    </div>
    <span joyrideStep="economyTour@coinsBalance" [text]="'tour.coinsBalanceDesc' | t" stepPosition="bottom">
      <app-pill colour="warning" size="md">
        <span class="flex items-center gap-1 font-semibold" [attr.aria-label]="userCoins() + ' ' + ('common.coins' | t)">
          <span class="text-lg" aria-hidden="true">&#x1FA99;</span> {{ userCoins() }}
        </span>
      </app-pill>
    </span>
  </div>

  <!-- Category filters -->
  <div class="px-4 pb-4 overflow-x-auto" role="group" [attr.aria-label]="'sticker.filterCategory' | t">
    <div class="flex gap-2">
      @for (pill of categoryPills(); track pill.id) {
        <button
          type="button"
          class="rounded-full px-4 py-2 text-sm font-medium transition-all duration-200"
          [class.bg-indigo-600]="selectedCategory() === pill.id"
          [class.text-white]="selectedCategory() === pill.id"
          [class.bg-neutral-800]="selectedCategory() !== pill.id"
          [class.text-neutral-300]="selectedCategory() !== pill.id"
          [attr.aria-pressed]="selectedCategory() === pill.id"
          (click)="selectedCategory.set(pill.id)"
        >
          {{ pill.label }}
        </button>
      }
    </div>
  </div>

  <!-- Loading -->
  @if (isLoading()) {
    <div class="flex items-center justify-center py-20" role="status" aria-live="polite">
      <div class="h-8 w-8 animate-spin rounded-full border-3 border-indigo-500 border-t-transparent" aria-hidden="true"></div>
      <span class="ms-3 text-neutral-400">{{ 'common.loading' | t }}</span>
    </div>
  }

  <!-- Empty state -->
  @if (!isLoading() && filteredPacks().length === 0) {
    <app-empty-state
      icon="&#x1F3A8;"
      [title]="'stickerStore.emptyTitle' | t"
      [description]="'stickerStore.emptyDescription' | t"
    />
  }

  <!-- Packs grid -->
  @if (!isLoading() && filteredPacks().length > 0) {
    <div class="px-4 pb-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" role="list" [attr.aria-label]="'stickerStore.packsList' | t">
      @for (pack of filteredPacks(); track pack.id) {
        <app-card
          variant="elevated"
          padding="md"
          role="listitem"
          class="relative flex flex-col overflow-hidden transition-all duration-200"
          [class.opacity-60]="pack.owned"
        >
          <!-- Pack illustration -->
          <div
            class="relative mb-3 flex h-28 items-center justify-center rounded-xl shadow-lg"
            [class]="'bg-gradient-to-br ' + getPackColour(pack.id)"
            aria-hidden="true"
          >
            <span class="text-5xl drop-shadow-lg">{{ getPackIllustration(pack.id) }}</span>
            @if (pack.owned) {
              <div
                class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50"
              >
                <span class="rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                  {{ 'stickerStore.ownedBadge' | t }}
                </span>
              </div>
            }
            @if (pack.is_animated && !pack.owned) {
              <div
                class="absolute top-2 end-2 rounded-full bg-fuchsia-500 px-2 py-0.5 text-xs font-bold text-white shadow-lg"
              >
                {{ 'stickerStore.animatedBadge' | t }}
              </div>
            }
          </div>

          <!-- Pack details -->
          <h3 class="text-sm font-semibold text-white mb-1">{{ pack.name }}</h3>
          @if (pack.is_animated) {
            <p class="text-xs text-fuchsia-400 mb-1">{{ 'stickerStore.animatedDescription' | t }}</p>
          }

          <!-- Purchase section -->
          <div class="mt-auto pt-2">
            @if (pack.owned) {
              <div
                class="flex w-full items-center justify-center rounded-full bg-emerald-500/20 py-2 text-sm font-medium text-emerald-400"
              >
                {{ 'stickerStore.unlocked' | t }}
              </div>
            } @else {
              <button
                type="button"
                class="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 py-2 text-sm font-semibold text-white transition-all disabled:opacity-50"
                [disabled]="userCoins() < pack.cost_coins || purchasingId() === pack.id"
                [attr.aria-label]="'stickerStore.purchasePack' | t: { packName: pack.name, cost: pack.cost_coins }"
                (click)="purchasePack(pack)"
              >
                @if (purchasingId() === pack.id) {
                  <div class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true"></div>
                } @else {
                  <span class="text-base" aria-hidden="true">&#x1FA99;</span>
                  {{ pack.cost_coins }}
                }
              </button>
            }
          </div>
        </app-card>
      }
    </div>
  }
</div>
`,
  styles: [`
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border-width: 0;
    }
  `],
})
export class StickerStoreComponent {
  private readonly economyStore = inject(EconomyStore);
  private readonly i18n = inject(I18nService);

  readonly isLoading = signal<boolean>(true);
  readonly purchasingId = signal<string | null>(null);

  private packsResource = resource<
    StickerPack[],
    void
  >({
    loader: async () => {
      this.isLoading.set(true);
      try {
        await this.economyStore.loadStickerPacks();
        return this.economyStore.stickerPacks();
      } finally {
        this.isLoading.set(false);
      }
    },
  });

  readonly packs = computed(
    () => this.packsResource.value() ?? this.economyStore.stickerPacks(),
  );

  readonly userCoins = computed(() => this.economyStore.coinsBalance());

  readonly categories = computed(() => {
    const cats = new Set<string>();
    for (const pack of this.packs()) {
      const price = pack.cost_coins;
      if (price <= 100) cats.add('value');
      else if (price <= 300) cats.add('popular');
      else cats.add('premium');
    }
    return [...cats];
  });

  readonly selectedCategory = signal<string>('all');

  readonly filteredPacks = computed(() => {
    const all = this.packs();
    const cat = this.selectedCategory();
    if (cat === 'all') return all;
    if (cat === 'value') return all.filter((p) => p.cost_coins <= 100);
    if (cat === 'popular')
      return all.filter((p) => p.cost_coins > 100 && p.cost_coins <= 300);
    if (cat === 'premium') return all.filter((p) => p.cost_coins > 300);
    return all;
  });

  readonly categoryPills = computed(() => [
    { id: 'all', label: this.i18n.translate('sticker.filterAll') },
    {
      id: 'value',
      label: this.i18n.translate('sticker.filterValue'),
    },
    {
      id: 'popular',
      label: this.i18n.translate('sticker.filterPopular'),
    },
    {
      id: 'premium',
      label: this.i18n.translate('sticker.filterPremium'),
    },
  ]);

  getPackIllustration(packId: string): string {
    const map: Record<string, string> = {
      stk_pack_1: '🐶',
      stk_pack_2: '🦄',
      stk_pack_3: '📚',
      stk_pack_4: '🐉',
      stk_pack_5: '🎉',
      stk_pack_6: '😌',
      stk_pack_7: '🍕',
      stk_pack_8: '✈️',
    };
    return map[packId] ?? '🎨';
  }

  getPackColour(packId: string): string {
    const colours = [
      'from-amber-500 to-orange-600',
      'from-pink-500 to-purple-600',
      'from-emerald-500 to-teal-600',
      'from-yellow-500 to-red-600',
      'from-violet-500 to-fuchsia-600',
      'from-cyan-500 to-blue-600',
      'from-rose-500 to-pink-600',
      'from-sky-500 to-indigo-600',
    ];
    const index = parseInt(packId.split('_').pop() ?? '1', 10) - 1;
    return colours[index % colours.length] ?? colours[0];
  }

  async purchasePack(pack: StickerPack): Promise<void> {
    if (pack.owned) return;
    this.purchasingId.set(pack.id);
    try {
      await this.economyStore.unlockStickerPack(pack.id);
    } finally {
      this.purchasingId.set(null);
    }
  }
}
