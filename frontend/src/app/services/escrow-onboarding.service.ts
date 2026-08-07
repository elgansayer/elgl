import { Injectable, signal, inject } from '@angular/core';
import { JoyrideService } from 'ngx-joyride';
import { I18nService } from './i18n.service';

export interface EscrowOnboardingStep {
  key: string;
  title: string;
  text: string;
}

/**
 * Manages the onboarding tour state for the Escrow Payments feature.
 * Steps correspond to `joyrideStep` directive names in the template.
 */
@Injectable({ providedIn: 'root' })
export class EscrowOnboardingService {
  private readonly joyrideService = inject(JoyrideService);
  private readonly i18n = inject(I18nService);
  private readonly storageKey = 'hellotalk_escrow_onboarding_done';

  /** Whether the escrow onboarding tour has been completed this session. */
  readonly isTourInProgress = signal(false);

  /** Step names registered with the JoyrideDirective in the EscrowPaymentsComponent. */
  readonly steps: EscrowOnboardingStep[] = [
    {
      key: 'escrowStepTitle',
      title: 'Escrow Payments',
      text: 'Welcome to Escrow Payments. Securely hold coins until both parties confirm the transaction is complete.',
    },
    {
      key: 'escrowStepCreate',
      title: 'Create a Payment',
      text: 'Tap here to create a new escrow payment. Choose the recipient, amount, and service type.',
    },
    {
      key: 'escrowStepFilters',
      title: 'Filter by Status',
      text: 'Use these chips to filter transactions by their current status: pending, released, refunded, or disputed.',
    },
    {
      key: 'escrowStepTransactions',
      title: 'Your Transactions',
      text: 'This list shows all your escrow transactions. Tap action buttons on pending transactions to release, refund, or dispute them.',
    },
  ];

  get stepNames(): string[] {
    return this.steps.map((s) => s.key);
  }

  startTour(): void {
    if (this.joyrideService.isTourInProgress()) {
      return;
    }

    this.isTourInProgress.set(true);

    this.joyrideService.startTour({
      steps: this.stepNames,
      stepDefaultPosition: 'bottom',
      themeColor: '#6366f1',
      showCounter: true,
      showPrevButton: true,
      customTexts: {
        prev: this.i18n.translate('tour.prev'),
        next: this.i18n.translate('tour.next'),
        done: this.i18n.translate('tour.done'),
        close: this.i18n.translate('tour.close'),
      },
    }).subscribe({
      complete: () => {
        this.markComplete();
      },
      error: () => {
        this.isTourInProgress.set(false);
      },
    });
  }

  markComplete(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.setItem(this.storageKey, 'true');
    } catch {
      // storage unavailable, ignore
    }
  }

  isCompleted(): boolean {
    try {
      return window.localStorage.getItem(this.storageKey) === 'true';
    } catch {
      return false;
    }
  }
}