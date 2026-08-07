import { Component, inject, signal, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { EscrowService } from '../../services/escrow.service';
import { NetworkStatusService } from '../../services/network-status.service';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';
import type { EscrowRow, EscrowStatus, EscrowServiceType } from '../../services/escrow-offline.service';

type StatusFilter = 'all' | EscrowStatus;

interface StatusFilterItem {
  value: StatusFilter;
  label: string;
}

@Component({
  selector: 'app-escrow-payments',
  imports: [DatePipe, TranslatePipe],
  templateUrl: './escrow-payments.component.html',
})
export class EscrowPaymentsComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly escrowService = inject(EscrowService);
  private readonly network = inject(NetworkStatusService);
  private readonly onboardingService = inject(EscrowOnboardingService);

  readonly isOnline = this.network.isOnline;
  readonly escrows = this.escrowService.escrows;
  readonly loading = this.escrowService.loading;
  readonly pendingOperationCount = this.escrowService.pendingOperationCount;

  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly selectedStatus = signal<StatusFilter>('all');
  readonly actionInProgress = signal(false);

  readonly statusFilters: StatusFilterItem[] = [
    { value: 'all', label: 'escrow.filter.all' },
    { value: 'pending', label: 'escrow.filter.pending' },
    { value: 'released', label: 'escrow.filter.released' },
    { value: 'refunded', label: 'escrow.filter.refunded' },
    { value: 'disputed', label: 'escrow.filter.disputed' },
    { value: 'cancelled', label: 'escrow.filter.cancelled' },
  ];

  readonly filteredEscrows = computed(() => {
    const filter = this.selectedStatus();
    const txs = this.escrows();
    if (filter === 'all') return txs;
    return txs.filter((tx) => tx.status === filter);
  });

  async loadEscrows(): Promise<void> {
    await this.escrowService.listUserEscrows();
  }

  setStatusFilter(filter: StatusFilter): void {
    this.selectedStatus.set(filter);
  }

  async handleRelease(escrowId: string): Promise<void> {
    await this.escrowService.releaseEscrow(escrowId);
    this.successMessage.set(this.i18n.translate('escrow.releaseSuccess'));
  }

  async handleRefund(escrowId: string): Promise<void> {
    await this.escrowService.refundEscrow(escrowId);
    this.successMessage.set(this.i18n.translate('escrow.refundSuccess'));
  }

  async handleDispute(escrowId: string): Promise<void> {
    await this.escrowService.disputeEscrow(escrowId, 'Reason: ');
    this.successMessage.set(this.i18n.translate('escrow.disputeSuccess'));
  }

  async handleSync(): Promise<void> {
    this.actionInProgress.set(true);
    try {
      await this.escrowService.syncOfflineOperations();
    } finally {
      this.actionInProgress.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  startOnboardingTour(): void {
    if (this.onboardingService.isCompleted()) return;
    this.onboardingService.isTourInProgress.set(true);

    setTimeout(() => {
      this.onboardingService.isTourInProgress.set(false);
      this.onboardingService.markComplete();
    }, 500);
  }

  statusBadgeClass(status: EscrowStatus): string {
    switch (status) {
      case 'pending':
        return 'bg-amber-500/20 text-amber-400';
      case 'released':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'disputed':
        return 'bg-rose-500/20 text-rose-400';
      case 'refunded':
        return 'bg-slate-500/20 text-slate-400';
      case 'cancelled':
        return 'bg-zinc-500/20 text-zinc-400';
      default:
        return 'bg-surface-200 text-text-secondary';
    }
  }

  clearMessages(): void {
    this.error.set(null);
    this.successMessage.set(null);
  }
}