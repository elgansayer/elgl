import {
  IsString,
  IsInt,
  IsOptional,
  IsObject,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEscrowHoldDto {
  @ApiProperty({ description: 'ID of the user receiving the payment' })
  @IsString()
  payee_id!: string;

  @ApiProperty({ description: 'Amount of coins to hold in escrow', minimum: 1 })
  @IsInt()
  @Min(1)
  amount_coins!: number;

  @ApiProperty({ description: 'Reason for the escrow hold', maxLength: 500 })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the transaction',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ReleaseEscrowDto {
  @ApiProperty({ description: 'ID of the escrow transaction to release' })
  @IsString()
  transaction_id!: string;
}

export class RefundEscrowDto {
  @ApiProperty({ description: 'ID of the escrow transaction to refund' })
  @IsString()
  transaction_id!: string;

  @ApiPropertyOptional({ description: 'Reason for the refund' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CancelEscrowDto {
  @ApiProperty({ description: 'ID of the escrow transaction to cancel' })
  @IsString()
  transaction_id!: string;
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

export interface CircuitBreakerStatusResponse {
  service: string;
  isOpen: boolean;
  failureCount: number;
  cooldownUntil: number;
  totalFailures: number;
  totalSuccesses: number;
}
