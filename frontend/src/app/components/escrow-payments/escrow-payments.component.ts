import { Component, inject, signal, computed, afterNextRender, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DatePipe, Location } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';

type EscrowStatus = 'pending' | 'released' | 'refunded' | 'disputed' | 'cancelled';
type EscrowServiceType = 'lesson' | 'language_exchange' | 'proofreading' | 'translation' | 'other';
type StatusFilter = 'all' | EscrowStatus;

interface EscrowRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  status: EscrowStatus;
  description: string;
  service_type: EscrowServiceType;
  dispute_reason?: string | null;
  dispute_evidence?: string | null;
  admin_note?: string | null;
  created_at: string;
  updated_at: string;
}

interface StatusFilterEntry {
  value: StatusFilter;
  label: string;
}

@Component({
  selector: 'app-escrow-payments',
  imports: [FormsModule, DatePipe, TranslatePipe],
  templateUrl: './escrow-payments.component.html',
})
export class EscrowPaymentsComponent {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private readonly onboardingService = inject(EscrowOnboardingService);
  private readonly location = inject(Location);

  readonly isOnline = signal(true);
  readonly actionInProgress = signal(false);
  readonly loading = signal(false);
  readonly successMessage = signal<string | null>(null);
  readonly showCreateForm = signal(false);
  readonly showDisputeForm = signal<string | null>(null);

  readonly selectedStatus = signal<StatusFilter>('all');

  readonly transactions = signal<EscrowRow[]>([]);

  readonly createForm = signal<{
    partner_id: string;
    amount: number;
    description: string;
    service_type: EscrowServiceType;
  }>({
    partner_id: '',
    amount: 0,
    description: '',
    service_type: 'other',
  });

  readonly disputeReason = signal('');
  readonly disputeEvidence = signal('');
  readonly refundReason = signal('');

  readonly statusFilters: StatusFilterEntry[] = [
    { value: 'all', label: 'escrow.status.all' },
    { value: 'pending', label: 'escrow.status.pending' },
    { value: 'released', label: 'escrow.status.released' },
    { value: 'refunded', label: 'escrow.status.refunded' },
    { value: 'disputed', label: 'escrow.status.disputed' },
    { value: 'cancelled', label: 'escrow.status.cancelled' },
  ];

  readonly escrows = computed(() => {
    const filter = this.selectedStatus();
    if (filter === 'all') return this.transactions();
    return this.transactions().filter((tx) => tx.status === filter);
  });

  readonly pendingOperationCount = signal(0);

  constructor() {
    this.auth.getAccessToken();
    afterNextRender(() => {
      this.onboardingService.markComplete();
      this.loadTransactions();
    });
  }

  private async loadTransactions(): Promise<void> {
    this.loading.set(true);
    try {
      const token = this.auth.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const result = await firstValueFrom(
        this.http.get<EscrowRow[]>(`${environment.apiUrl}/escrow`, { headers }),
      );
      this.transactions.set(result ?? []);
    } catch {
      // offline or error, keep existing data
    } finally {
      this.loading.set(false);
    }
  }

  refreshTransactions(): void {
    void this.loadTransactions();
  }

  async handleRelease(escrowId: string): Promise<void> {
    this.actionInProgress.set(true);
    try {
      const token = this.auth.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/escrow/release`, { escrow_id: escrowId }, { headers }),
      );
      this.successMessage.set(this.i18n.translate('escrow.releaseSuccess'));
      this.refreshTransactions();
    } catch {
      this.successMessage.set(null);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleRefund(escrowId: string): Promise<void> {
    this.actionInProgress.set(true);
    try {
      const token = this.auth.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/escrow/refund`, { escrow_id: escrowId, reason: this.refundReason() || undefined }, { headers }),
      );
      this.successMessage.set(this.i18n.translate('escrow.refundSuccess'));
      this.refreshTransactions();
    } catch {
      this.successMessage.set(null);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleDispute(escrowId: string): Promise<void> {
    this.actionInProgress.set(true);
    try {
      const token = this.auth.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/escrow/dispute`, {
          escrow_id: escrowId,
          reason: this.disputeReason() || 'Dispute filed',
          evidence: this.disputeEvidence() || undefined,
        }, { headers }),
      );
      this.successMessage.set(this.i18n.translate('escrow.disputeSuccess'));
      this.refreshTransactions();
    } catch {
      this.successMessage.set(null);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleSync(): Promise<void> {
    this.actionInProgress.set(true);
    await this.loadTransactions();
    this.actionInProgress.set(false);
  }

  setStatusFilter(filter: StatusFilter): void {
    this.selectedStatus.set(filter);
  }

  goBack(): void {
    this.location.back();
  }

  startOnboardingTour(): void {
    this.onboardingService.startTour();
  }

  getStatusLabel(status: EscrowStatus): string {
    return this.i18n.translate(`escrow.status.${status}`);
  }

  getStatusClass(status: EscrowStatus): string {
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
        return 'bg-slate-800/60 text-slate-300';
    }
  }

  getServiceTypeLabel(type: EscrowServiceType): string {
    return this.i18n.translate(`escrow.serviceType.${type}`);
  }

  clearMessages(): void {
    this.successMessage.set(null);
  }

  statusBadgeClass(status: EscrowStatus): string {
    return this.getStatusClass(status);
  }

  async createPayment(): Promise<void> {
    const form = this.createForm();
    if (!form.partner_id || form.amount <= 0 || !form.description) return;

    this.actionInProgress.set(true);
    try {
      const token = this.auth.getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      await firstValueFrom(
        this.http.post(`${environment.apiUrl}/escrow/create`, {
          partner_id: form.partner_id,
          amount: form.amount,
          description: form.description,
          service_type: form.service_type,
        }, { headers }),
      );
      this.successMessage.set(this.i18n.translate('escrow.createSuccess'));
      this.showCreateForm.set(false);
      this.createForm.set({ partner_id: '', amount: 0, description: '', service_type: 'other' });
      this.refreshTransactions();
    } catch {
      this.successMessage.set(null);
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async submitDispute(): Promise<void> {
    const txId = this.showDisputeForm();
    if (!txId || !this.disputeReason()) return;

    await this.handleDispute(txId);
    this.showDisputeForm.set(null);
    this.disputeReason.set('');
    this.disputeEvidence.set('');
  }
}
