export interface EscrowPayment {
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: EscrowPaymentStatus;
  description: string;
  terms_locked: boolean;
  payer_approved: boolean;
  payee_approved: boolean;
  dispute_reason: string | null;
  dispute_resolved_by: string | null;
  refund_amount: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export type EscrowPaymentStatus =
  | 'pending'
  | 'funded'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'cancelled';
