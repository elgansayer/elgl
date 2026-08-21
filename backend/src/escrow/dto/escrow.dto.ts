import {
  IsString,
  IsInt,
  IsOptional,
  IsObject,
  IsNotEmpty,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEscrowDto {
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

  @ApiPropertyOptional({
    description:
      'Description of the service being paid for via the escrow hold',
    maxLength: 500,
    example: 'Payment for 30-minute Spanish lesson',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description:
      'Additional metadata for the transaction (e.g., service type, lesson details, milestone information)',
    example: { service_type: 'lesson', lesson_id: 'abc-123' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateEscrowHoldDto {
  @ApiProperty({ description: 'UUID of the user receiving the payment' })
  @IsString()
  payee_id!: string;

  @ApiProperty({ description: 'Amount of coins to hold', minimum: 1 })
  @IsInt()
  @Min(1)
  amount_coins!: number;

  @ApiProperty({ description: 'Reason for placing the hold' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ description: 'Additional escrow metadata' })
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

export class DisputeEscrowDto {
  @ApiProperty({
    description: 'UUID of the escrow transaction to dispute',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  transaction_id!: string;

  @ApiProperty({
    description: 'Reason for the dispute',
    example: 'Service was not delivered as agreed',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({
    description: 'Supporting evidence or details for the dispute',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidence?: string;
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

export class AcknowledgeCrashReportDto {
  @ApiProperty({
    description: 'UUID of the crash report to acknowledge',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsString()
  report_id!: string;
}

export interface CrashReportResponse {
  id: string;
  operation: string;
  escrow_id?: string;
  user_id?: string;
  error_type: string;
  error_message: string;
  stack_trace?: string;
  context?: Record<string, unknown>;
  created_at: string;
  acknowledged: boolean;
  resolved_at?: string | null;
}
