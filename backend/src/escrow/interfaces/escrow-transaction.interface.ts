export interface EscrowTransaction {
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: EscrowStatus;
  reason: string;
  metadata: Record<string, unknown>;
  held_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  cancelled_at: string | null;
  retry_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export type EscrowStatus =
  'pending' | 'held' | 'released' | 'refunded' | 'cancelled' | 'failed';

export interface EscrowReleaseResult {
  success: boolean;
  transaction_id: string;
  degraded: boolean;
  fallback_reason?: string;
}

export interface EscrowHoldResult {
  success: boolean;
  transaction_id: string;
  degraded: boolean;
  fallback_reason?: string;
}

export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailure: number;
  cooldownUntil: number;
  totalFailures: number;
  totalSuccesses: number;
}
