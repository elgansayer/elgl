import { Component, inject, signal, computed, resource, afterNextRender } from '@angular/core';
import { Location } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { NetworkStatusService } from '../../services/network-status.service';
import { JoyrideModule, JoyrideService, JoyrideOptions } from 'ngx-joyride';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';
import { EscrowService } from '../../services/escrow.service';

type EscrowStatus = 'pending' | 'released' | 'refunded' | 'disputed' | 'cancelled';
type EscrowServiceType = 'lesson' | 'language_exchange' | 'proofreading' | 'translation' | 'other';
type StatusFilter = 'all' | EscrowStatus;

interface StatusFilterOption {
  value: StatusFilter;
  label: string;
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
  imports: [FormsModule, DatePipe, TranslatePipe, JoyrideModule],
  templateUrl: './escrow-payments.component.html',
})
export class EscrowPaymentsComponent {
  private readonly location = inject(Location);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly network = inject(NetworkStatusService);
  private readonly joyrideService = inject(JoyrideService);
  private readonly onboardingService = inject(EscrowOnboardingService);
  private readonly escrowService = inject(EscrowService);

  protected readonly isOnline = this.network.isOnline;
  protected readonly pendingOperationCount = this.escrowService.pendingOperationCount;

  readonly selectedStatus = signal<StatusFilter>('all');
  readonly showCreateForm = signal(false);
  readonly showDisputeForm = signal<string | null>(null);
  readonly actionInProgress = signal(false);
  readonly error = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

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

  readonly statusFilters: StatusFilterOption[] = [
    { value: 'all', label: 'escrow.status.all' },
    { value: 'pending', label: 'escrow.status.pending' },
    { value: 'released', label: 'escrow.status.released' },
    { value: 'refunded', label: 'escrow.status.refunded' },
    { value: 'disputed', label: 'escrow.status.disputed' },
    { value: 'cancelled', label: 'escrow.status.cancelled' },
  ];

  private readonly escrowsResource = resource({
    loader: async () => {
      this.actionInProgress.set(true);
      this.error.set(null);
      try {
        return await this.escrowService.listEscrows();
      } catch {
        this.error.set(this.i18n.translate('escrow.loadError'));
        return [];
      } finally {
        this.actionInProgress.set(false);
      }
    },
  });

  readonly escrows = computed(() => this.escrowsResource.value() ?? []);
  readonly loading = computed(() => this.escrowsResource.isLoading());

  constructor() {
    afterNextRender(() => {
      this.maybeStartTour();
    });
  }

  async handleRelease(escrowId: string): Promise<void> {
    this.actionInProgress.set(true);
    this.error.set(null);
    try {
      await this.escrowService.releaseEscrow(escrowId);
      this.successMessage.set(this.i18n.translate('escrow.releaseSuccess'));
      this.escrowsResource.reload();
    } catch {
      this.error.set(this.i18n.translate('escrow.releaseError'));
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleRefund(escrowId: string): Promise<void> {
    this.actionInProgress.set(true);
    this.error.set(null);
    try {
      await this.escrowService.refundEscrow(escrowId, this.refundReason() || undefined);
      this.successMessage.set(this.i18n.translate('escrow.refundSuccess'));
      this.refundReason.set('');
      this.escrowsResource.reload();
    } catch {
      this.error.set(this.i18n.translate('escrow.refundError'));
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleDispute(escrowId: string): Promise<void> {
    if (!this.disputeReason()) return;

    this.actionInProgress.set(true);
    this.error.set(null);
    try {
      await this.escrowService.disputeEscrow(
        escrowId,
        this.disputeReason(),
        this.disputeEvidence() || undefined,
      );
      this.successMessage.set(this.i18n.translate('escrow.disputeSuccess'));
      this.disputeReason.set('');
      this.disputeEvidence.set('');
      this.escrowsResource.reload();
    } catch {
      this.error.set(this.i18n.translate('escrow.disputeError'));
    } finally {
      this.actionInProgress.set(false);
    }
  }

  async handleSync(): Promise<void> {
    this.actionInProgress.set(true);
    try {
      const result = await this.escrowService.syncOfflineOperations();
      this.successMessage.set(
        this.i18n.translate('escrow.syncSuccess', {
          sent: String(result.sent),
          failed: String(result.failed),
        }),
      );
      this.escrowsResource.reload();
    } catch {
      this.error.set(this.i18n.translate('escrow.syncError'));
    } finally {
      this.actionInProgress.set(false);
    }
  }

  startOnboardingTour(): void {
    this.onboardingService.startTour();
  }

  setStatusFilter(filter: StatusFilter): void {
    this.selectedStatus.set(filter);
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

  goBack(): void {
    this.location.back();
  }

  private maybeStartTour(): void {
    if (this.onboardingService.isCompleted()) {
      return;
    }
    if (this.onboardingService.isTourInProgress()) {
      return;
    }
    this.onboardingService.isTourInProgress.set(true);

    setTimeout(() => {
      const options: JoyrideOptions = {
        steps: this.onboardingService.stepNames,
        startWith: 'escrowStepTitle',
        waitingTime: 100,
        stepDefaultPosition: 'bottom',
        themeColor: '#6366f1',
        showCounter: true,
        showPrevButton: true,
      };

      firstValueFrom(this.joyrideService.startTour(options))
        .then(() => this.onboardingService.markComplete())
        .catch(() => this.onboardingService.isTourInProgress.set(false));
    }, 500);
  }
}