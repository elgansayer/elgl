<<<<<<< HEAD
<<<<<<< HEAD
import { Component, inject, signal, computed, AfterViewInit, ErrorHandler } from '@angular/core';
=======
import { Component, inject, signal, computed, AfterViewInit, OnInit } from '@angular/core';
>>>>>>> origin/main
=======
import { Component, inject, signal, computed, resource, afterNextRender, effect } from '@angular/core';
>>>>>>> origin/main
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { JoyrideModule, JoyrideService, JoyrideOptions } from 'ngx-joyride';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';
import { SrsErrorBoundaryComponent, SrsErrorContext } from '../srs-error-boundary/srs-error-boundary.component';

type EscrowStatus = 'pending' | 'released' | 'refunded' | 'disputed' | 'cancelled';
type EscrowServiceType = 'lesson' | 'language_exchange' | 'proofreading' | 'translation' | 'other';
type StatusFilter = 'all' | EscrowStatus;

class EscrowPaymentsError extends Error {
  override name = 'EscrowPaymentsError';
  constructor(
    message: string,
    readonly escrowOperation: string,
    readonly escrowId?: string,
    stack?: string,
  ) {
    super(message);
    if (stack) {
      this.stack = stack;
    }
  }
}

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
  imports: [FormsModule, DatePipe, TranslatePipe, JoyrideModule, SrsErrorBoundaryComponent],
  templateUrl: './escrow-payments.component.html',
})
<<<<<<< HEAD
export class EscrowPaymentsComponent {
=======
export class EscrowPaymentsComponent implements OnInit, AfterViewInit {
>>>>>>> origin/main
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private readonly joyrideService = inject(JoyrideService);
  private readonly onboardingService = inject(EscrowOnboardingService);
  private errorHandler = inject(ErrorHandler);

  /** Signal to trigger transaction list resource reload after mutations. */
  private readonly refreshTrigger = signal(0);

  readonly transactions = signal<EscrowRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly statusFilter = signal<StatusFilter>('all');
  readonly showCreateForm = signal(false);
  readonly showDisputeForm = signal<string | null>(null);

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

<<<<<<< HEAD
  readonly errorContext = computed<SrsErrorContext>(() => ({
    component: 'escrow-payments',
    operation: 'payment-management',
  }));

  handleRetry(): void {
    this.clearMessages();
    void this.loadTransactions();
  }

  private reportEscrowError(operation: string, escrowId?: string, err?: unknown): void {
    const message = err instanceof Error ? err.message : String(err ?? 'Unknown error');
    const escrowError = new EscrowPaymentsError(
      `[Escrow:${operation}] ${message}`,
      operation,
      escrowId,
      err instanceof Error ? err.stack : undefined,
    );
    this.errorHandler.handleError(escrowError);
  }

  async loadTransactions(status?: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const token = this.auth.getAccessToken();
    try {
      const params = status ? `?status=${status}` : '';
=======
  /** Resource-based data loading: auto-fetches transactions and reloads on mutations. */
  private readonly transactionsResource = resource({
    request: () => this.refreshTrigger(),
    loader: async ({ request: _ }) => {
      const token = this.auth.getAccessToken();
>>>>>>> origin/main
      const result = await firstValueFrom(
        this.http.get<EscrowRow[]>(
          `${environment.apiUrl}/escrow`,
          { headers: { Authorization: `Bearer ${token ?? ''}` } },
        ),
      );
<<<<<<< HEAD
      this.transactions.set(result ?? []);
    } catch (err: unknown) {
      this.reportEscrowError('loadTransactions', undefined, err);
      this.error.set(this.i18n.translate('escrow.loadError'));
    } finally {
      this.loading.set(false);
    }
=======
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
>>>>>>> origin/main
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
<<<<<<< HEAD
      await this.loadTransactions();
    } catch (err: unknown) {
      this.reportEscrowError('createPayment', undefined, err);
=======
      this.refreshTransactions();
    } catch {
>>>>>>> origin/main
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
<<<<<<< HEAD
      await this.loadTransactions();
    } catch (err: unknown) {
      this.reportEscrowError('releasePayment', escrowId, err);
=======
      this.refreshTransactions();
    } catch {
>>>>>>> origin/main
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
<<<<<<< HEAD
      await this.loadTransactions();
    } catch (err: unknown) {
      this.reportEscrowError('refundPayment', escrowId, err);
=======
      this.refreshTransactions();
    } catch {
>>>>>>> origin/main
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
<<<<<<< HEAD
      await this.loadTransactions();
    } catch (err: unknown) {
      this.reportEscrowError('submitDispute', txId, err);
=======
      this.refreshTransactions();
    } catch {
>>>>>>> origin/main
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