export type EscrowStatus =
  'pending' | 'released' | 'refunded' | 'disputed' | 'cancelled';

export type EscrowServiceType =
  'lesson' | 'language_exchange' | 'proofreading' | 'translation' | 'other';

export interface EscrowRow {
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

export interface EscrowCreateResult {
  id: string;
  status: EscrowStatus;
  amount_held: number;
  coins_remaining: number;
}

export interface EscrowReleaseResult {
  id: string;
  status: 'released';
  amount_released: number;
  receiver_new_balance: number;
}

export interface EscrowRefundResult {
  id: string;
  status: 'refunded';
  amount_refunded: number;
  sender_new_balance: number;
}
