import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../services/translate.pipe';
import { EscrowService } from '../../services/escrow.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { EscrowRow } from '../../services/escrow-offline.service';

@Component({
  selector: 'app-escrow-payments',
  imports: [TranslatePipe],
  templateUrl: './escrow-payments.component.html',
  host: {
    '[class]': "'block min-h-screen'",
  },
})
export class EscrowPaymentsComponent {
  private readonly escrowService = inject(EscrowService);
  private readonly network = inject(NetworkStatusService);
  private readonly router = inject(Router);

  readonly isOnline = this.network.isOnline;
  readonly loading = this.escrowService.loading;
  readonly escrows = this.escrowService.escrows;
  readonly pendingOperationCount = this.escrowService.pendingOperationCount;

  readonly selectedStatus = signal<string | undefined>(undefined);
  readonly actionInProgress = signal(false);

  readonly statusFilters = [
    { label: 'escrow.filterAll', value: undefined },
    { label: 'escrow.filterPending', value: 'pending' },
    { label: 'escrow.filterReleased', value: 'released' },
    { label: 'escrow.filterRefunded', value: 'refunded' },
    { label: 'escrow.filterDisputed', value: 'disputed' },
    { label: 'escrow.filterCancelled', value: 'cancelled' },
  ] as const;

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadEscrows();
    }
  }

  async loadEscrows(): Promise<void> {
    await this.escrowService.listUserEscrows(this.selectedStatus());
  }

  async setStatusFilter(status: string | undefined): Promise<void> {
    this.selectedStatus.set(status);
    await this.loadEscrows();
  }

  async handleRelease(escrowId: string): Promise<void> {
    this.actionInProgress.set(true);
    try {
      await this.escrowService.releaseEscrow(escrowId);
      await this.loadEscrows();
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleRefund(escrowId: string): Promise<void> {
    this.actionInProgress.set(true);
    try {
      await this.escrowService.refundEscrow(escrowId);
      await this.loadEscrows();
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleDispute(escrowId: string): Promise<void> {
    this.actionInProgress.set(true);
    try {
      await this.escrowService.disputeEscrow(
        escrowId,
        'Service not as described',
      );
      await this.loadEscrows();
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleSync(): Promise<void> {
    this.actionInProgress.set(true);
    try {
      await this.escrowService.syncOfflineOperations();
      await this.loadEscrows();
    } finally {
      this.actionInProgress.set(false);
    }
  }

  statusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      released: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
      refunded: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
      disputed: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
      cancelled: 'bg-slate-600/20 text-slate-500 border border-slate-500/30',
    };
    return classes[status] ?? classes.pending;
  }

  goBack(): void {
    this.router.navigate(['/settings']);
  }
}