import { Component, inject, signal, computed, resource, afterNextRender, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
export class EscrowPaymentsComponent implements OnInit, AfterViewInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private readonly joyrideService = inject(JoyrideService);
  private readonly onboardingService = inject(EscrowOnboardingService);

  /** Signal to trigger transaction list resource reload after mutations. */
  private readonly refreshTrigger = signal(0);

  readonly transactions = signal<EscrowRow[]>([]);
  readonly loading = signal(false);
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

  readonly disputeReason = signal('');
  readonly disputeEvidence = signal('');
  readonly refundReason = signal('');

  readonly statusFilters: StatusFilter[] = ['all', 'pending', 'released', 'refunded', 'disputed', 'cancelled'];

  readonly filteredTransactions = computed(() => {
    const filter = this.statusFilter();
    if (filter === 'all') return this.transactions();
    return this.transactions().filter((tx) => tx.status === filter);
  });

  readonly statusCounts = computed(() => {
    const txs = this.transactions();
    return {
      all: txs.length,
      pending: txs.filter((tx) => tx.status === 'pending').length,
      released: txs.filter((tx) => tx.status === 'released').length,
      refunded: txs.filter((tx) => tx.status === 'refunded').length,
      disputed: txs.filter((tx) => tx.status === 'disputed').length,
      cancelled: txs.filter((tx) => tx.status === 'cancelled').length,
    };
  });

  readonly pendingCount = computed(() =>
    this.transactions().filter((tx) => tx.status === 'pending').length,
  );

  /** Resource-based data loading: auto-fetches transactions and reloads on mutations. */
  private readonly transactionsResource = resource({
    request: () => this.refreshTrigger(),
    loader: async ({ request: _ }) => {
      const token = this.auth.getAccessToken();
      const result = await firstValueFrom(
        this.http.get<EscrowRow[]>(
          `${environment.apiUrl}/escrow`,
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
      return result ?? [];
    },
  });

  /** Sync resource data into the transactions signal and start onboarding tour. */
  constructor() {
    effect(() => {
      const data = this.transactionsResource.value();
      if (data !== undefined) {
        this.transactions.set(data);
      }
    });

    // Third-party lib (Joyride) requires DOM-ready state; afterNextRender is the
    // mandated replacement for ngAfterViewInit per Section 5.3.
    afterNextRender(() => {
      this.maybeStartTour();
    });
  }

  refreshTransactions(): void {
    this.refreshTrigger.update((v) => v + 1);
  }

  async createPayment(): Promise<void> {
    const form = this.createForm();
    if (!form.partner_id || form.amount <= 0 || !form.description) return;

    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.getAccessToken();
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/escrow/create`,
          {
            partner_id: form.partner_id,
            amount: form.amount,
            description: form.description,
            service_type: form.service_type,
          },
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
      this.successMessage.set(this.i18n.translate('escrow.createSuccess'));
      this.showCreateForm.set(false);
      this.createForm.set({ partner_id: '', amount: 0, description: '', service_type: 'other' });
      this.refreshTransactions();
    } catch {
      this.error.set(this.i18n.translate('escrow.createError'));
    } finally {
      this.loading.set(false);
    }
  }

  async releasePayment(escrowId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.getAccessToken();
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/escrow/release`,
          { escrow_id: escrowId },
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
      this.successMessage.set(this.i18n.translate('escrow.releaseSuccess'));
      this.refreshTransactions();
    } catch {
      this.error.set(this.i18n.translate('escrow.releaseError'));
    } finally {
      this.loading.set(false);
    }
  }

  async refundPayment(escrowId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.getAccessToken();
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/escrow/refund`,
          { escrow_id: escrowId, reason: this.refundReason() || undefined },
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
      this.successMessage.set(this.i18n.translate('escrow.refundSuccess'));
      this.refundReason.set('');
      this.refreshTransactions();
    } catch {
      this.error.set(this.i18n.translate('escrow.refundError'));
    } finally {
      this.loading.set(false);
    }
  }

  async submitDispute(): Promise<void> {
    const txId = this.showDisputeForm();
    if (!txId || !this.disputeReason()) return;

    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.getAccessToken();
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/escrow/dispute`,
          {
            escrow_id: txId,
            reason: this.disputeReason(),
            evidence: this.disputeEvidence() || undefined,
          },
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
      this.successMessage.set(this.i18n.translate('escrow.disputeSuccess'));
      this.showDisputeForm.set(null);
      this.disputeReason.set('');
      this.disputeEvidence.set('');
      this.refreshTransactions();
    } catch {
      this.error.set(this.i18n.translate('escrow.disputeError'));
    } finally {
      this.loading.set(false);
    }
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

  /** Start onboarding tour using firstValueFrom to avoid unmanaged subscription. */
  private maybeStartTour(): void {
    if (this.onboardingService.isCompleted()) {
      return;
    }
    if (this.onboardingService.isTourInProgress()) {
      return;
    }
    this.onboardingService.isTourInProgress.set(true);

    const options: JoyrideOptions = {
      steps: this.onboardingService.stepNames,
      startWith: 'escrowStepTitle',
      waitingTime: 100,
      stepDefaultPosition: 'bottom',
      themeColor: '#6366f1',
      showCounter: true,
      showPrevButton: true,
    };

    // JoyrideService.startTour returns an Observable; convert to Promise for clean teardown.
    firstValueFrom(this.joyrideService.startTour(options))
      .then(() => {
        this.onboardingService.markComplete();
      })
      .catch(() => {
        this.onboardingService.isTourInProgress.set(false);
      });
  }
}