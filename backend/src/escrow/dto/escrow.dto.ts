import {
<<<<<<< HEAD
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateEscrowDto {
  @IsUUID()
  @IsNotEmpty()
  payee_id!: string;

  @IsInt()
  @Min(1)
  @Max(1000000)
  amount_coins!: number;

  @IsString()
  @IsNotEmpty()
  reference_type!: string;

  @IsString()
  @IsNotEmpty()
  reference_id!: string;

  @IsOptional()
  @IsString()
  metadata?: string;
}

export class ReleaseEscrowDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['release', 'refund', 'cancel'])
  action!: 'release' | 'refund' | 'cancel';

  @IsOptional()
  @IsString()
  reason?: string;
}

export class EscrowListQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['payer', 'payee'])
  role?: 'payer' | 'payee';

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'held', 'released', 'refunded', 'cancelled', 'disputed'])
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
=======
  IsString,
  IsInt,
  IsOptional,
  IsObject,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEscrowHoldDto {
  @ApiProperty({
    description: 'UUID of the user receiving the payment (payee)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  payee_id!: string;

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
  @MaxLength(500)
  reason!: string;

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
  @MaxLength(500)
  reason?: string;
}

export class CancelEscrowDto {
  @ApiProperty({
    description: 'UUID of the escrow transaction to cancel',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
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
>>>>>>> origin/main
}
