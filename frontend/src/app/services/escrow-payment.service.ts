import { Injectable, inject, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { showToast } from './toast.service';
import type { EscrowErrorReport } from '../components/escrow-payment/error-boundary.component';

export interface EscrowPayment {
  id: string;
  partyAId: string;
  partyBId: string;
  amount: number;
  currency: string;
  status: EscrowStatus;
  description?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export type EscrowStatus =
  | 'awaiting_deposit'
  | 'funds_held'
  | 'disputed'
  | 'released'
  | 'refunded'
  | 'cancelled';

export interface CreateEscrowRequest {
  partyBId: string;
  amount: number;
  currency: string;
  description?: string;
  expiresInDays?: number;
}

export interface EscrowOperationResult {
  success: boolean;
  escrow?: EscrowPayment;
  error?: EscrowErrorReport;
}

/**
 * Service for managing escrow payments on the frontend.
 * Provides reactive signal-based state and robust error reporting
 * integrated with the GlobalErrorHandler and API crash reporting pipeline.
 */
@Injectable({ providedIn: 'root' })
export class EscrowPaymentService {
  private apiService = inject(ApiService);

  private readonly escrowList = signal<EscrowPayment[]>([]);
  private readonly activeEscrow = signal<EscrowPayment | null>(null);
  private readonly lastError = signal<EscrowErrorReport | null>(null);
  private readonly isLoading = signal(false);

  readonly escrows = computed(() => this.escrowList());
  readonly active = computed(() => this.activeEscrow());
  readonly error = computed(() => this.lastError());
  readonly loading = computed(() => this.isLoading());

  private prefix = '/api/escrow-payments';

  async createEscrow(request: CreateEscrowRequest): Promise<EscrowOperationResult> {
    return this.withErrorBoundary(async () => {
      const result = await this.apiService.post<EscrowPayment>(
        `${this.prefix}/create`,
        request,
        { requireAuth: true },
      );
      showToast(
        'escrow.toast.created',
        'success',
      );
      return result;
    });
  }

  async depositFunds(escrowId: string): Promise<EscrowOperationResult> {
    return this.withErrorBoundary(async () => {
      const result = await this.apiService.post<EscrowPayment>(
        `${this.prefix}/deposit`,
        { escrowId },
        { requireAuth: true },
      );
      this.activeEscrow.set(result);
      showToast(
        'escrow.toast.funds_deposited',
        'success',
      );
      return result;
    });
  }

  async releaseFunds(escrowId: string): Promise<EscrowOperationResult> {
    return this.withErrorBoundary(async () => {
      const result = await this.apiService.post<EscrowPayment>(
        `${this.prefix}/release`,
        { escrowId },
        { requireAuth: true },
      );
      this.activeEscrow.set(result);
      showToast(
        'escrow.toast.funds_released',
        'success',
      );
      return result;
    });
  }

  async openDispute(escrowId: string, reason: string): Promise<EscrowOperationResult> {
    return this.withErrorBoundary(async () => {
      const result = await this.apiService.post<EscrowPayment>(
        `${this.prefix}/dispute`,
        { escrowId, reason },
        { requireAuth: true },
      );
      this.activeEscrow.set(result);
      showToast(
        'escrow.toast.dispute_opened',
        'warning',
      );
      return result;
    });
  }

  async cancelEscrow(escrowId: string, reason?: string): Promise<EscrowOperationResult> {
    return this.withErrorBoundary(async () => {
      const result = await this.apiService.post<EscrowPayment>(
        `${this.prefix}/cancel`,
        { escrowId, reason },
        { requireAuth: true },
      );
      this.activeEscrow.set(result);
      return result;
    });
  }

  async loadEscrow(escrowId: string): Promise<EscrowOperationResult> {
    return this.withErrorBoundary(async () => {
      const result = await this.apiService.get<EscrowPayment>(
        `${this.prefix}/${escrowId}`,
        { requireAuth: true },
      );
      this.activeEscrow.set(result);
      return result;
    });
  }

  async loadUserEscrows(): Promise<EscrowOperationResult> {
    return this.withErrorBoundary(async () => {
      const result = await this.apiService.get<EscrowPayment[]>(
        this.prefix,
        { requireAuth: true },
      );
      this.escrowList.set(result);
      return result as unknown as EscrowPayment;
    });
  }

  clearError(): void {
    this.lastError.set(null);
  }

  clearActiveEscrow(): void {
    this.activeEscrow.set(null);
  }

  /**
   * Wrap escrow operations with robust error handling.
   * Catches structured escrow errors from the backend and converts
   * them into EscrowErrorReport objects for the error boundary UI.
   */
  private async withErrorBoundary<T extends EscrowPayment | EscrowPayment[]>(
    operation: () => Promise<T>,
  ): Promise<EscrowOperationResult> {
    this.isLoading.set(true);
    this.lastError.set(null);

    try {
      const escrow = await operation();
      this.isLoading.set(false);

      if (Array.isArray(escrow)) {
        return { success: true };
      }

      return { success: true, escrow: escrow as EscrowPayment };
    } catch (err: unknown) {
      this.isLoading.set(false);

      const errorReport = this.parseEscrowError(err);
      this.lastError.set(errorReport);

      // Also fire-and-forget to the crash reporting pipeline
      this.reportErrorToAnalytics(errorReport, err);

      return { success: false, error: errorReport };
    }
  }

  private parseEscrowError(err: unknown): EscrowErrorReport {
    if (err && typeof err === 'object') {
      const apiError = err as Record<string, unknown>;
      const response = apiError['error'] as Record<string, unknown> | undefined;

      if (response?.errorCode) {
        return {
          errorCode: String(response.errorCode),
          message: String(response.message ?? 'Unknown escrow error'),
          isRecoverable: Boolean(response.isRecoverable ?? response.context?.isRecoverable ?? true),
          escrowId: (response.context as Record<string, unknown>)?.escrowId as string | undefined,
          timestamp: String(response.timestamp ?? new Date().toISOString()),
        };
      }

      if (apiError['status'] && apiError['statusText']) {
        return {
          errorCode: 'HTTP_ERROR',
          message: `HTTP ${apiError['status']}: ${apiError['statusText']}`,
          isRecoverable: true,
          timestamp: new Date().toISOString(),
        };
      }
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      errorCode: 'UNKNOWN',
      message,
      isRecoverable: true,
      timestamp: new Date().toISOString(),
    };
  }

  private async reportErrorToAnalytics(
    report: EscrowErrorReport,
    rawError: unknown,
  ): Promise<void> {
    try {
      await this.apiService.post(
        '/api/analytics/client-error',
        {
          message: `[Escrow:Frontend] ${report.message}`,
          name: `EscrowError:${report.errorCode}`,
          url: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          metadata: {
            escrowErrorCode: report.errorCode,
            escrowId: report.escrowId,
            isFrontendReport: true,
            isRecoverable: report.isRecoverable,
            rawErrorType: typeof rawError,
          },
          timestamp: new Date().toISOString(),
        },
        { requireAuth: false },
      );
    } catch {
      // Best-effort reporting; cannot log logging failures
    }
  }
}