<<<<<<< HEAD
export enum EscrowStatus {
  PENDING = 'pending',
  HELD = 'held',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export interface EscrowPayment {
=======
export interface EscrowTransaction {
>>>>>>> origin/main
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: EscrowStatus;
<<<<<<< HEAD
  reference_type: string;
  reference_id: string;
  held_at: string;
  expires_at: string;
  released_at: string | null;
  refunded_at: string | null;
  cancelled_at: string | null;
  dispute_reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EscrowPaymentListResult {
  payments: EscrowPayment[];
  total: number;
  page: number;
  pageSize: number;
=======
  description: string | null;
  reference_id: string | null;
  created_at: string;
  updated_at: string;
  released_at: string | null;
  refunded_at: string | null;
}

export type EscrowStatus = 'held' | 'released' | 'refunded' | 'disputed';

export interface CreateEscrowResult {
  id: string;
  status: EscrowStatus;
  amount_coins: number;
  payer_balance: number;
}

export interface ReleaseEscrowResult {
  id: string;
  status: EscrowStatus;
  amount_coins: number;
  payee_balance: number;
}

export interface RefundEscrowResult {
  id: string;
  status: EscrowStatus;
  amount_coins: number;
  payer_balance: number;
>>>>>>> origin/main
}
