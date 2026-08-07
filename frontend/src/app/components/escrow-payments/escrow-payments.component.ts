<<<<<<< HEAD
import { Component, inject, signal, computed, AfterViewInit, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import { JoyrideModule, JoyrideService } from 'ngx-joyride';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';

interface JoyrideOptions {
  steps: string[];
  startWith?: string;
  waitingTime?: number;
  stepDefaultPosition?: string;
  themeColor?: string;
  showCounter?: boolean;
  showPrevButton?: boolean;
}

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
=======
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { JoyrideDirective } from 'ngx-joyride';
import { TranslatePipe } from '../../services/translate.pipe';
import { EscrowService } from '../../services/escrow.service';
import { EscrowOnboardingService } from '../../services/escrow-onboarding.service';
import { NetworkStatusService } from '../../services/network-status.service';
>>>>>>> origin/main

@Component({
  selector: 'app-escrow-payments',
  imports: [JoyrideDirective, TranslatePipe],
  templateUrl: './escrow-payments.component.html',
  host: {
    '[class]': "'block min-h-screen'",
  },
})
<<<<<<< HEAD
export class EscrowPaymentsComponent implements AfterViewInit, OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);
  private readonly joyrideService = inject(JoyrideService);
  private readonly onboardingService = inject(EscrowOnboardingService);
=======
export class EscrowPaymentsComponent {
  private readonly escrowService = inject(EscrowService);
  private readonly escrowOnboarding = inject(EscrowOnboardingService);
  private readonly network = inject(NetworkStatusService);
  private readonly router = inject(Router);
>>>>>>> origin/main

  readonly isOnline = this.network.isOnline;
  readonly loading = this.escrowService.loading;
  readonly escrows = this.escrowService.escrows;
  readonly pendingOperationCount = this.escrowService.pendingOperationCount;
  readonly onboardingTourInProgress = this.escrowOnboarding.isTourInProgress;

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

  startOnboardingTour(): void {
    this.escrowOnboarding.startTour();
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