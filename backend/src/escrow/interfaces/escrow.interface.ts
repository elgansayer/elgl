export interface EscrowTransaction {
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: EscrowStatus;
  description: string | null;
  reference_id: string | null;
  created_at: string;
  updated_at: string;
  released_at: string | null;
  refunded_at: string | null;
}

export type EscrowStatus =
  | 'held'
  | 'released'
  | 'refunded'
  | 'disputed'
  | 'release_pending'
  | 'refund_pending';

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
}

export interface ReconcileEscrowResult {
  id: string;
  status: EscrowStatus;
  amount_coins: number;
  reconciliation: 'completed' | 'already_consistent';
}
