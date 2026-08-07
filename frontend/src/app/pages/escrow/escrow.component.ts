import { Component, inject, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { EscrowStore } from '../../services/escrow.store';

@Component({
  selector: 'app-escrow',
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="min-h-screen bg-surface-0 text-white px-4 py-6">
      <header class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">{{ 'escrow.title' | t }}</h1>
        <button
          class="bg-accent-primary text-black px-4 py-2 rounded-full font-semibold text-sm"
          routerLink="/escrow/create"
        >
          {{ 'escrow.createButton' | t }}
        </button>
      </header>

      @if (summary(); as s) {
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div class="bg-surface-500 rounded-xl p-4">
            <p class="text-xs text-neutral-400">{{ 'escrow.outgoing' | t }}</p>
            <p class="text-lg font-bold">{{ s.total_outgoing | number }}</p>
          </div>
          <div class="bg-surface-500 rounded-xl p-4">
            <p class="text-xs text-neutral-400">{{ 'escrow.incoming' | t }}</p>
            <p class="text-lg font-bold">{{ s.total_incoming | number }}</p>
          </div>
          <div class="bg-surface-500 rounded-xl p-4">
            <p class="text-xs text-neutral-400">{{ 'escrow.pending' | t }}</p>
            <p class="text-lg font-bold">{{ s.pending_outgoing + s.pending_incoming | number }}</p>
          </div>
        </div>
      }

      <div class="flex gap-2 mb-4 overflow-x-auto">
        @for (tab of tabs(); track tab.key) {
          <button
            class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            [class.bg-accent-primary]="activeFilter() === tab.key"
            [class.text-black]="activeFilter() === tab.key"
            [class.bg-surface-500]="activeFilter() !== tab.key"
            [class.text-neutral-300]="activeFilter() !== tab.key"
            (click)="activeFilter.set(tab.key)"
          >
            {{ tab.label }}
          </button>
        }
      </div>

      @if (isLoading()) {
        <div class="space-y-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="bg-surface-500 rounded-xl p-4 animate-pulse">
              <div class="h-4 bg-surface-400 rounded w-3/4 mb-2"></div>
              <div class="h-3 bg-surface-400 rounded w-1/2"></div>
            </div>
          }
        </div>
      } @else if (filteredEscrows().length === 0) {
        <div class="text-center py-12">
          <p class="text-neutral-400 text-lg mb-2">{{ 'escrow.emptyTitle' | t }}</p>
          <p class="text-neutral-500 text-sm">{{ 'escrow.emptySubtitle' | t }}</p>
        </div>
      } @else {
        <div class="space-y-3">
          @for (escrow of filteredEscrows(); track escrow.id) {
            <a
              [routerLink]="['/escrow', escrow.id]"
              class="block bg-surface-500 rounded-xl p-4 hover:bg-surface-400 transition-colors"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="font-semibold text-sm">{{ escrow.description }}</span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full font-medium"
                  [class]="statusClass(escrow.status)"
                >
                  {{ 'escrow.status.' + escrow.status | t }}
                </span>
              </div>
              <div class="flex items-center justify-between text-xs text-neutral-400">
                <span>
                  {{ escrow.sender_id === currentUserId() ? ('escrow.to' | t) : ('escrow.from' | t) }}
                  {{ escrow.sender_id === currentUserId() ? escrow.receiver_id : escrow.sender_id }}
                </span>
                <span class="font-semibold text-accent-primary">
                  {{ escrow.amount }} {{ 'common.coins' | t }}
                </span>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class EscrowComponent {
  private escrowStore = inject(EscrowStore);

  readonly escrows = this.escrowStore.escrows;
  readonly summary = this.escrowStore.summary;
  readonly isLoading = this.escrowStore.isLoading;
  readonly error = this.escrowStore.error;

  readonly activeFilter = signal<string>('all');

  readonly tabs = computed(() => {
    const statuses: { key: string; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: 'pending', label: 'Pending' },
      { key: 'released', label: 'Released' },
      { key: 'disputed', label: 'Disputed' },
      { key: 'cancelled', label: 'Cancelled' },
    ];
    return statuses;
  });

  readonly currentUserId = signal<string>('');

  readonly filteredEscrows = computed(() => {
    const filter = this.activeFilter();
    if (filter === 'all') return this.escrows();
    return this.escrows().filter((e) => e.status === filter);
  });

  constructor() {
    this.escrowStore.loadEscrows();
    this.escrowStore.loadSummary();
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      released: 'bg-green-500/20 text-green-400',
      disputed: 'bg-red-500/20 text-red-400',
      refunded: 'bg-blue-500/20 text-blue-400',
      cancelled: 'bg-neutral-500/20 text-neutral-400',
    };
    return map[status] ?? 'bg-neutral-500/20 text-neutral-400';
  }
}