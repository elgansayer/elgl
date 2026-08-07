import { Component, inject, signal, computed, AfterViewInit, DestroyRef, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { JoyrideModule, JoyrideService, JoyrideOptions } from 'ngx-joyride';
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

@Component({
  selector: 'app-escrow-payments',
  standalone: true,
  imports: [FormsModule, DatePipe, TranslatePipe, JoyrideModule],
  templateUrl: './escrow-payments.component.html',
})
export class EscrowPaymentsComponent implements AfterViewInit, OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private readonly joyrideService = inject(JoyrideService);
  private readonly onboardingService = inject(EscrowOnboardingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly transactions = signal<EscrowRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly statusFilter = signal<StatusFilter>('all');
  readonly showCreateForm = signal(false);
  readonly showDisputeForm = signal<string | null>(null);

  readonly createForm = signal({
    partner_id: '',
    amount: 0,
    description: '',
    service_type: 'other' as EscrowServiceType,
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

  async loadTransactions(status?: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.getAccessToken();
    try {
      const params = status ? `?status=${status}` : '';
      const result = await firstValueFrom(
        this.http.get<EscrowRow[]>(
          `${environment.apiUrl}/escrow${params}`,
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
      this.transactions.set(result ?? []);
    } catch {
      this.error.set(this.i18n.translate('escrow.loadError'));
    } finally {
      this.loading.set(false);
    }
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
      await this.loadTransactions();
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
      await this.loadTransactions();
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
      await this.loadTransactions();
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
      await this.loadTransactions();
    } catch {
      this.error.set(this.i18n.translate('escrow.disputeError'));
    } finally {
      this.loading.set(false);
    }
  }

  setStatusFilter(filter: StatusFilter): void {
    this.statusFilter.set(filter);
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
        return 'bg-surface-200 text-text-secondary';
    }
  }

  getServiceTypeLabel(type: EscrowServiceType): string {
    return this.i18n.translate(`escrow.serviceType.${type}`);
  }

  clearMessages(): void {
    this.error.set(null);
    this.successMessage.set(null);
  }

  ngOnInit(): void {
    this.loadTransactions();
  }

  ngAfterViewInit(): void {
    this.maybeStartTour();
  }

  private maybeStartTour(): void {
    if (this.onboardingService.isCompleted()) {
      return;
    }
    if (this.onboardingService.isTourInProgress()) {
      return;
    }
    this.onboardingService.isTourInProgress.set(true);

    const timerId = window.setTimeout(() => {
      const options: JoyrideOptions = {
        steps: this.onboardingService.stepNames,
        startWith: 'escrowStepTitle',
        waitingTime: 100,
        stepDefaultPosition: 'bottom',
        themeColor: '#6366f1',
        showCounter: true,
        showPrevButton: true,
      };

      this.joyrideService.startTour(options)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => {
            this.onboardingService.isTourInProgress.set(false);
          },
          complete: () => {
            this.onboardingService.markComplete();
          },
        });
    }, 500);
    this.destroyRef.onDestroy(() => clearTimeout(timerId));
  }
}