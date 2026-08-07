export enum EscrowStatus {
  PENDING = 'pending',
  HELD = 'held',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  DISPUTED = 'disputed',
}

export interface EscrowPayment {
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: EscrowStatus;
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
}
