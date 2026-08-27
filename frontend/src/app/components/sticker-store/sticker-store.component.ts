import { HlmButton } from '@spartan-ng/helm/button';
import { Component, inject, signal, computed, resource } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { I18nService } from '../../services/i18n.service';
import { EconomyStore, StickerPack } from '../../services/economy.store';
import { AppCardComponent } from '../primitives/card/card.component';

import { AppPillComponent } from '../primitives/pill/pill.component';
import { AppEmptyStateComponent } from '../primitives/empty-state/empty-state.component';

@Component({
  selector: 'app-sticker-store',
  imports: [HlmButton, TranslatePipe, AppCardComponent, AppPillComponent, AppEmptyStateComponent],
  template: `<div class="min-h-screen bg-surface-500">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <div>
        <h1 class="text-2xl font-bold text-text-primary">{{ 'stickerStore.title' | t }}</h1>
        <p class="text-sm text-text-secondary mt-1">{{ 'stickerStore.subtitle' | t }}</p>
      </div>
      <app-pill colour="warning" size="md">
        <span class="flex items-center gap-1 font-semibold">
          <span class="text-lg">&#x1FA99;</span> {{ userCoins() }}
        </span>
      </app-pill>
    </div>

    @if (!isOnline()) {
      <div
        class="mx-4 mb-4 rounded-sheet border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text-primary"
        role="status"
        aria-live="polite"
      >
        {{ 'economy.offlinePurchaseUnavailable' | t }}
      </div>
    }

    <!-- Category filters -->
    <div class="px-4 pb-4 overflow-x-auto">
      <div class="flex gap-2" role="group" [attr.aria-label]="'sticker.filterLabel' | t">
        @for (pill of categoryPills(); track pill.id) {
          <button
            hlmBtn
            type="button"
            class="rounded-full px-4 py-2 text-sm font-medium transition-all duration-200"
            [class.bg-primary]="selectedCategory() === pill.id"
            [class.text-on-fill]="selectedCategory() === pill.id"
            [class.bg-surface-100]="selectedCategory() !== pill.id"
            [class.text-text-secondary]="selectedCategory() !== pill.id"
            (click)="selectedCategory.set(pill.id)"
            [attr.aria-pressed]="selectedCategory() === pill.id"
          >
            {{ pill.label }}
          </button>
        }
      </div>
    </div>

    <!-- Loading -->
    @if (isLoading()) {
      <div
        class="flex items-center justify-center py-20"
        role="status"
        [attr.aria-label]="'common.loading' | t"
      >
        <div
          class="h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent"
          aria-hidden="true"
        ></div>
        <span class="ms-3 text-text-secondary">{{ 'common.loading' | t }}</span>
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
      <div class="px-4 pb-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" role="list">
        @for (pack of filteredPacks(); track pack.id) {
          <app-card
            variant="elevated"
            padding="md"
            class="relative flex flex-col overflow-hidden transition-all duration-200"
            [class.opacity-60]="pack.owned"
            role="listitem"
          >
            <!-- Pack illustration -->
            <div
              class="relative mb-3 flex h-28 items-center justify-center rounded-xl shadow-lg"
              [class]="'bg-gradient-to-br ' + getPackColour(pack.id)"
            >
              <span class="text-5xl drop-shadow-lg" aria-hidden="true">{{
                getPackIllustration(pack.id)
              }}</span>
              @if (pack.owned) {
                <div
                  class="absolute inset-0 flex items-center justify-center rounded-xl bg-surface-900/50"
                >
                  <span
                    class="rounded-full bg-success px-3 py-1 text-xs font-bold text-on-fill shadow-lg"
                  >
                    {{ 'stickerStore.ownedBadge' | t }}
                  </span>
                </div>
              }
              @if (pack.is_animated && !pack.owned) {
                <div
                  class="absolute top-2 end-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-on-fill shadow-lg"
                >
                  {{ 'stickerStore.animatedBadge' | t }}
                </div>
              }
            </div>

            <!-- Pack details -->
            <h3 class="text-sm font-semibold text-text-primary mb-1">{{ pack.name }}</h3>
            @if (pack.is_animated) {
              <p class="text-xs text-accent mb-1">{{ 'stickerStore.animatedDescription' | t }}</p>
            }

            <!-- Purchase section -->
            <div class="mt-auto pt-2">
              @if (pack.owned) {
                <div
                  class="flex w-full items-center justify-center rounded-full bg-success/20 py-2 text-sm font-medium text-success"
                >
                  {{ 'stickerStore.unlocked' | t }}
                </div>
              } @else {
                <button
                  hlmBtn
                  type="button"
                  class="flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-vip to-accent py-2 text-sm font-semibold text-on-fill transition-all disabled:opacity-50"
                  [disabled]="
                    userCoins() < pack.cost_coins || purchasingId() !== null || !isOnline()
                  "
                  (click)="purchasePack(pack)"
                  [attr.aria-label]="
                    'stickerStore.purchaseAria' | t: { name: pack.name, cost: pack.cost_coins }
                  "
                >
                  @if (purchasingId() === pack.id) {
                    <div
                      class="h-4 w-4 animate-spin rounded-full border-2 border-on-fill border-t-transparent"
                      aria-hidden="true"
                    ></div>
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
  </div> `,
})
export class StickerStoreComponent {
  private readonly economyStore = inject(EconomyStore);
  private readonly i18n = inject(I18nService);

  readonly isLoading = signal<boolean>(true);
  readonly purchasingId = signal<string | null>(null);
  readonly isOnline = this.economyStore.isOnline;

  private packsResource = resource<StickerPack[], void>({
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

  readonly packs = computed(() => {
    this.packsResource.value();
    return this.economyStore.stickerPacks();
  });

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
    if (cat === 'popular') return all.filter((p) => p.cost_coins > 100 && p.cost_coins <= 300);
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
      stk_pack_1: '\u{1F436}',
      stk_pack_2: '\u{1F984}',
      stk_pack_3: '\u{1F4DA}',
      stk_pack_4: '\u{1F409}',
      stk_pack_5: '\u{1F389}',
      stk_pack_6: '\u{1F60C}',
      stk_pack_7: '\u{1F355}',
      stk_pack_8: '\u{2708}\u{FE0F}',
    };
    return map[packId] ?? '\u{1F3A8}';
  }

  getPackColour(packId: string): string {
    // Decorative-only variety across sticker packs - sourced from the `neon`
    // gamification accents plus the duet/accent/semantic tokens (see
    // DESIGN.md's "neon" row: "streaks, leaderboard, gift flourishes").
    // Backgrounds only, never paired with text per that guidance.
    const colours = [
      'from-vip to-neon-orange',
      'from-neon-pink to-neon-violet',
      'from-success to-secondary',
      'from-accent to-danger',
      'from-neon-violet to-accent',
      'from-neon-cyan to-neon-blue',
      'from-danger to-neon-pink',
      'from-neon-blue to-secondary',
    ];
    const index = parseInt(packId.split('_').pop() ?? '1', 10) - 1;
    return colours[index % colours.length] ?? colours[0];
  }

  async purchasePack(pack: StickerPack): Promise<void> {
    if (pack.owned || !this.isOnline() || this.purchasingId() !== null) return;
    this.purchasingId.set(pack.id);
    try {
      await this.economyStore.unlockStickerPack(pack.id);
    } finally {
      this.purchasingId.set(null);
    }
  }
}