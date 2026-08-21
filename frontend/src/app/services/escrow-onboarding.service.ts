import { Injectable, signal } from '@angular/core';

export interface EscrowOnboardingStep {
  key: string;
  title: string;
  text: string;
}

/**
 * Manages the onboarding tour state for the Escrow Payments feature.
 * Joyride-based tours have been removed; this service is retained as a compat shim.
 */
@Injectable({ providedIn: 'root' })
export class EscrowOnboardingService {
  private readonly storageKey = 'hellotalk_escrow_onboarding_done';

  readonly isTourInProgress = signal(false);

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
    // Tour disabled -- mark as complete immediately
    this.markComplete();
  }

  markComplete(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.setItem(this.storageKey, 'true');
    } catch {
      // storage unavailable, ignore
    }
  }

  resetTour(): void {
    this.isTourInProgress.set(false);
    try {
      window.localStorage.removeItem(this.storageKey);
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