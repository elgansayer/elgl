import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_REASON_LENGTH = 1000;
const MAX_EVIDENCE_LENGTH = 5000;
const MAX_ADMIN_NOTE_LENGTH = 2000;
const MAX_PAGE_SIZE = 100;

export class CreateEscrowDto {
  @IsUUID()
  partner_id!: string;

  @IsInt()
  @IsPositive()
  amount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description!: string;

  @IsOptional()
  @IsString()
  @IsIn(['lesson', 'language_exchange', 'proofreading', 'translation', 'other'])
  service_type?: string;
}

export class ReleaseEscrowDto {
  @IsUUID()
  escrow_id!: string;
}

export class RefundEscrowDto {
  @IsUUID()
  escrow_id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_REASON_LENGTH)
  reason?: string;
}

export class DisputeEscrowDto {
  @IsUUID()
  escrow_id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_REASON_LENGTH)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_EVIDENCE_LENGTH)
  evidence?: string;
}

export class ResolveDisputeDto {
  @IsUUID()
  escrow_id!: string;

  @IsString()
  @IsIn(['release', 'refund'])
  resolution!: 'release' | 'refund';

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ADMIN_NOTE_LENGTH)
  admin_note?: string;
}

export class ListEscrowDto {
  @IsOptional()
  @IsString()
  @IsIn(['pending', 'released', 'refunded', 'disputed', 'cancelled'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export interface PaginatedEscrowResponse {
  data: EscrowSummaryRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface EscrowSummaryRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  status: string;
  description: string;
  service_type: string;
  created_at: string;
  updated_at: string;
}
