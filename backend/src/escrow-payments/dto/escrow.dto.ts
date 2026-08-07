import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
  IsUUID,
} from 'class-validator';

export enum EscrowStatus {
  AWAITING_DEPOSIT = 'awaiting_deposit',
  FUNDS_HELD = 'funds_held',
  DISPUTED = 'disputed',
  RELEASED = 'released',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum EscrowEventType {
  ESCROW_CREATED = 'escrow_created',
  FUNDS_DEPOSITED = 'funds_deposited',
  FUNDS_RELEASED = 'funds_released',
  DISPUTE_OPENED = 'dispute_opened',
  DISPUTE_RESOLVED = 'dispute_resolved',
  ESCROW_CANCELLED = 'escrow_cancelled',
  ESCROW_ERROR = 'escrow_error',
}

export class CreateEscrowDto {
  @IsUUID()
  partyBId!: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsString()
  currency!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class ReleaseEscrowDto {
  @IsUUID()
  escrowId!: string;
}

export class RaiseDisputeDto {
  @IsUUID()
  escrowId!: string;

  @IsString()
  reason!: string;
}

export class ResolveDisputeDto {
  @IsUUID()
  escrowId!: string;

  @IsEnum(['release_to_party_b', 'refund_to_party_a'])
  resolution!: 'release_to_party_b' | 'refund_to_party_a';

  @IsOptional()
  @IsString()
  adminNotes?: string;
}

export class CancelEscrowDto {
  @IsUUID()
  escrowId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class EscrowResponseDto {
  id!: string;
  partyAId!: string;
  partyBId!: string;
  amount!: number;
  currency!: string;
  status!: EscrowStatus;
  description?: string;
  expiresAt!: string;
  createdAt!: string;
  updatedAt!: string;
}

export class EscrowEventPayloadDto {
  escrowId!: string;
  eventType!: EscrowEventType;
  partyAId?: string;
  partyBId?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  errorDetails?: EscrowErrorDetailsDto;
  timestamp!: string;
}

export class EscrowErrorDetailsDto {
  code!: string;
  message!: string;
  stack?: string;
  context?: Record<string, unknown>;
  isRecoverable!: boolean;
}