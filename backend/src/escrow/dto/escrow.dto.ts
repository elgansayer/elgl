import { Type } from 'class-transformer';
import {
  IsString,
<<<<<<< HEAD
  IsUUID,
  Max,
  MaxLength,
  Min,
=======
  IsInt,
  IsOptional,
  IsObject,
  Min,
  MaxLength,
>>>>>>> origin/main
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

<<<<<<< HEAD
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_REASON_LENGTH = 1000;
const MAX_EVIDENCE_LENGTH = 5000;
const MAX_ADMIN_NOTE_LENGTH = 2000;
const MAX_PAGE_SIZE = 100;

export class CreateEscrowDto {
  @IsUUID()
  partner_id!: string;
=======
export class CreateEscrowHoldDto {
  @ApiProperty({
    description: 'UUID of the user receiving the payment (payee)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  payee_id!: string;
>>>>>>> origin/main

  @ApiProperty({
    description: 'Amount of coins to hold in escrow',
    minimum: 1,
    example: 100,
  })
  @IsInt()
  @Min(1)
  amount_coins!: number;

  @ApiProperty({
    description: 'Description of the service being paid for via the escrow hold',
    maxLength: 500,
    example: 'Payment for 30-minute Spanish lesson',
  })
  @IsString()
<<<<<<< HEAD
  @IsNotEmpty()
  @MaxLength(MAX_DESCRIPTION_LENGTH)
  description!: string;
=======
  @MaxLength(500)
  reason!: string;
>>>>>>> origin/main

  @ApiPropertyOptional({
    description: 'Additional metadata for the transaction (e.g., service type, lesson details, milestone information)',
    example: { service_type: 'lesson', lesson_id: 'abc-123' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ReleaseEscrowDto {
  @ApiProperty({
    description: 'UUID of the escrow transaction to release',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  transaction_id!: string;
}

export class RefundEscrowDto {
  @ApiProperty({
    description: 'UUID of the escrow transaction to refund',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  transaction_id!: string;

  @ApiPropertyOptional({
    description: 'Reason for the refund',
    example: 'Service was not delivered as agreed',
  })
  @IsOptional()
  @IsString()
<<<<<<< HEAD
  @MaxLength(MAX_REASON_LENGTH)
=======
  @MaxLength(500)
>>>>>>> origin/main
  reason?: string;
}

export class CancelEscrowDto {
  @ApiProperty({
    description: 'UUID of the escrow transaction to cancel',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
<<<<<<< HEAD
  @IsNotEmpty()
  @MaxLength(MAX_REASON_LENGTH)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_EVIDENCE_LENGTH)
  evidence?: string;
=======
  transaction_id!: string;
>>>>>>> origin/main
}

export interface EscrowTransactionResponse {
  id: string;
  payer_id: string;
  payee_id: string;
  amount_coins: number;
  status: string;
  reason: string;
  metadata: Record<string, unknown>;
  held_at: string | null;
  released_at: string | null;
  refunded_at: string | null;
  cancelled_at: string | null;
  retry_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  degraded: boolean;
  fallback_reason?: string;
}

<<<<<<< HEAD
  @IsString()
  @IsIn(['release', 'refund'])
  resolution!: 'release' | 'refund';

  @IsOptional()
  @IsString()
  @MaxLength(MAX_ADMIN_NOTE_LENGTH)
  admin_note?: string;
=======
export interface CircuitBreakerStatusResponse {
  service: string;
  isOpen: boolean;
  failureCount: number;
  cooldownUntil: number;
  totalFailures: number;
  totalSuccesses: number;
>>>>>>> origin/main
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
