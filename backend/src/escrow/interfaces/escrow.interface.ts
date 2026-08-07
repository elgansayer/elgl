export interface EscrowTransaction {
  id: string;
<<<<<<< HEAD
  sender_id: string;
  recipient_id: string;
  transaction_subject: string;
  description?: string | null;
  amount_cents: number;
  currency: string;
  status:
    | 'pending'
    | 'funded'
    | 'partially_released'
    | 'completed'
    | 'disputed'
    | 'refunded'
    | 'cancelled';
  total_milestones: number;
  released_milestones: number;
  stripe_payment_intent_id?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  gdpr_retention_date: string;
  is_data_scrubbed: boolean;
}

export interface EscrowMilestone {
  id: string;
  escrow_id: string;
  milestone_index: number;
  title: string;
  amount_cents: number;
  status: 'pending' | 'released' | 'refunded';
  release_note?: string | null;
  released_at?: string | null;
  created_at: string;
}

export interface EscrowDispute {
  id: string;
  escrow_id: string;
  raised_by: string;
  reason: string;
  evidence_description?: string | null;
  status:
    | 'open'
    | 'under_review'
    | 'resolved_sender'
    | 'resolved_recipient'
    | 'cancelled';
  resolved_at?: string | null;
  resolution_note?: string | null;
  created_at: string;
}

export interface DataScrubbingResult {
  transaction_id: string;
  scrubbed_fields: string[];
  performed_at: string;
}
=======
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
}
<<<<<<< HEAD
>>>>>>> origin/main
=======
>>>>>>> origin/main
