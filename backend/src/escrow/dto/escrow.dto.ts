import { IsString, IsUUID, IsInt, Min, IsOptional, IsIn, MaxLength } from 'class-validator';

/**
 * DTO for creating a new escrow transaction.  The backend deducts the coin
 * amount from the payer immediately and locks it until the payee fulfills
 * the milestone or the payer releases it.
 */
export class CreateEscrowDto {
  @IsUUID()
  payee_id!: string;

  @IsInt()
  @Min(1)
  amount_coins!: number;

  @IsString()
  @MaxLength(2000)
  milestone_description!: string;
}

/**
 * DTO for releasing escrowed funds to the payee (called by the payer).
 */
export class ReleaseEscrowDto {
  @IsUUID()
  escrow_id!: string;
}

/**
 * DTO for requesting a refund (called by the payer before funds are released).
 */
export class RefundEscrowDto {
  @IsUUID()
  escrow_id!: string;
}

/**
 * DTO for raising a dispute on an escrow transaction.
 */
export class RaiseDisputeDto {
  @IsUUID()
  escrow_transaction_id!: string;

  @IsString()
  @MaxLength(2000)
  reason!: string;
}

/**
 * DTO for admin resolution of a dispute.
 */
export class ResolveDisputeDto {
  @IsUUID()
  dispute_id!: string;

  @IsString()
  @IsIn(['released_to_payee', 'refunded_to_payer', 'split'])
  resolution!: 'released_to_payee' | 'refunded_to_payer' | 'split';

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  resolution_notes?: string;
}

/**
 * Generic escrow transaction row shape returned by Supabase.
 */
export interface EscrowTransactionRow {
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: 'pending_held' | 'released' | 'refunded' | 'disputed';
  milestone_description: string;
  created_at: string;
  updated_at: string;
  released_at: string | null;
}

/**
 * Generic escrow dispute row shape returned by Supabase.
 */
export interface EscrowDisputeRow {
  id: string;
  escrow_transaction_id: string;
  raised_by_id: string;
  reason: string;
  resolution: 'pending' | 'released_to_payee' | 'refunded_to_payer' | 'split';
  resolution_notes: string;
  resolved_by_id: string | null;
  created_at: string;
  resolved_at: string | null;
}