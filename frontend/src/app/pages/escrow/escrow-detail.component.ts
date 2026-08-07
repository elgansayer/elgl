import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { EscrowStore, EscrowTransaction } from '../../services/escrow.store';

@Component({
  selector: 'app-escrow-detail',
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="min-h-screen bg-surface-0 text-white px-4 py-6">
      <header class="flex items-center gap-3 mb-6">
        <a routerLink="/escrow" class="text-accent-primary text-sm">
          ← {{ 'escrow.backToList' | t }}
        </a>
        <h1 class="text-xl font-bold">{{ 'escrow.detailTitle' | t }}</h1>
      </header>

      @if (isLoading()) {
        <div class="bg-surface-500 rounded-xl p-6 animate-pulse space-y-3">
          <div class="h-6 bg-surface-400 rounded w-1/2"></div>
          <div class="h-4 bg-surface-400 rounded w-3/4"></div>
          <div class="h-4 bg-surface-400 rounded w-1/3"></div>
        </div>
      } @else if (error()) {
        <div class="text-center py-12">
          <p class="text-red-400">{{ error() }}</p>
        </div>
      } @else if (escrow(); as e) {
        <div class="bg-surface-500 rounded-xl p-6 mb-4">
          <div class="flex items-center justify-between mb-4">
            <span
              class="text-xs px-2 py-0.5 rounded-full font-medium"
              [class]="statusClass(e.status)"
            >
              {{ 'escrow.status.' + e.status | t }}
            </span>
            <span class="text-sm text-neutral-400">{{ e.id }}</span>
          </div>

          <h2 class="text-lg font-semibold mb-3">{{ e.description }}</h2>

          <div class="space-y-2 text-sm text-neutral-300 mb-6">
            <div class="flex justify-between">
              <span>{{ 'escrow.amount' | t }}</span>
              <span class="font-bold text-accent-primary">{{ e.amount }} {{ 'common.coins' | t }}</span>
            </div>
            <div class="flex justify-between">
              <span>{{ 'escrow.created' | t }}</span>
              <span>{{ e.created_at | date:'medium' }}</span>
            </div>
            @if (e.service_type) {
              <div class="flex justify-between">
                <span>{{ 'escrow.serviceType' | t }}</span>
                <span>{{ 'escrow.serviceTypes.' + e.service_type | t }}</span>
              </div>
            }
          </div>

          @if (e.dispute_reason) {
            <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
              <p class="text-xs text-red-400 font-medium mb-1">{{ 'escrow.disputeReason' | t }}</p>
              <p class="text-sm text-neutral-300">{{ e.dispute_reason }}</p>
            </div>
          }

          @if (e.status === 'pending') {
            <div class="flex gap-2">
              <button
                class="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold text-sm"
                (click)="release()"
              >
                {{ 'escrow.release' | t }}
              </button>
              <button
                class="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-semibold text-sm"
                (click)="refund()"
              >
                {{ 'escrow.refund' | t }}
              </button>
              <button
                class="flex-1 bg-neutral-600 text-white py-2.5 rounded-lg font-semibold text-sm"
                (click)="dispute()"
              >
                {{ 'escrow.disputeButton' | t }}
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class EscrowDetailComponent {
  private route = inject(ActivatedRoute);
  private escrowStore = inject(EscrowStore);

  readonly escrow = this.escrowStore.selectedEscrow;
  readonly isLoading = this.escrowStore.isLoading;
  readonly error = this.escrowStore.error;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.escrowStore.getEscrow(id);
    }
  }

  async release(): Promise<void> {
    const e = this.escrow();
    if (e) {
      await this.escrowStore.releaseEscrow(e.id);
    }
  }

  async refund(): Promise<void> {
    const e = this.escrow();
    if (e) {
      await this.escrowStore.refundEscrow(e.id);
    }
  }

  dispute(): void {
    const e = this.escrow();
    if (!e) return;
    const reason = prompt('Dispute reason:');
    if (reason) {
      this.escrowStore.disputeEscrow(e.id, reason);
    }
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