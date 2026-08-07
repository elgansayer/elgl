import {
  IsString,
  IsInt,
  Min,
  MaxLength,
  IsOptional,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEscrowDto {
  @ApiProperty({
    description:
      'UUID of the payee (recipient) who will receive the coins once the escrow is released',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @IsString()
  payee_id!: string;

  @ApiProperty({
    description: 'Number of coins to hold in escrow (1-1,000,000)',
    example: 500,
    minimum: 1,
    maximum: 1000000,
  })
  @IsInt()
  @Min(1)
  @Max(1000000)
  amount_coins!: number;

  @ApiPropertyOptional({
    description:
      'Optional description of what the escrow is for (e.g. translation service payment)',
    example: 'Payment for English-to-French translation of 500 words',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Optional client-supplied reference ID for idempotency or external tracking',
    example: 'order_abc123',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference_id?: string;
}

export class ReleaseEscrowDto {
  @ApiProperty({
    description:
      'UUID of the escrow transaction to release (coins delivered to payee)',
    example: 'b7e4f1a2-c3d5-4e6f-8901-abcdef012345',
  })
  @IsString()
  escrow_id!: string;
}

export class RefundEscrowDto {
  @ApiProperty({
    description:
      'UUID of the escrow transaction to refund (coins returned to payer)',
    example: 'b7e4f1a2-c3d5-4e6f-8901-abcdef012345',
  })
  @IsString()
  escrow_id!: string;
}
