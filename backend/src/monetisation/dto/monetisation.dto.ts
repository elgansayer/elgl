import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDiagnosticLogDto {
  @ApiProperty({
    description: 'Backend service category being diagnosed',
    enum: ['POSTGIS', 'CENTRIFUGO', 'REDIS', 'LIVEKIT'],
    example: 'REDIS',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['POSTGIS', 'CENTRIFUGO', 'REDIS', 'LIVEKIT'])
  category!: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';

  @ApiProperty({
    description: 'Diagnostic check status',
    enum: ['info', 'success', 'warn'],
    example: 'success',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['info', 'success', 'warn'])
  status!: 'info' | 'success' | 'warn';

  @ApiProperty({
    description: 'Human-readable diagnostic message',
    example: 'Redis connection pool healthy',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class AppleReceiptValidationDto {
  @ApiProperty({
    description: 'Base64-encoded Apple App Store receipt data',
    example: 'MIITwQYJKoZIhvcNAQcCoIITsjCCE64CAQExCzAJBgUrDgMCGgUAM...',
  })
  @IsString()
  @IsNotEmpty()
  receipt_data!: string;

  @ApiPropertyOptional({
    description:
      'Whether to exclude old transactions from the response (Apple v2 API)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  exclude_old_transactions?: boolean;
}

export class CreateCheckoutSessionDto {
  @ApiProperty({
    description: 'Subscription plan ID',
    enum: [
      'consumer_8_ukp_10_usd',
      'consumer_50_ukp_63_usd',
      'pro_12_ukp_15_usd',
      'developer_20_ukp_26_usd',
    ],
    example: 'consumer_8_ukp_10_usd',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn([
    'consumer_8_ukp_10_usd',
    'consumer_50_ukp_63_usd',
    'pro_12_ukp_15_usd',
    'developer_20_ukp_26_usd',
  ])
  planId!: string;

  @ApiProperty({
    description: 'Billing interval for the subscription',
    enum: ['month', 'year'],
    example: 'month',
  })
  @IsString()
  @IsIn(['month', 'year'])
  interval!: 'month' | 'year';
}

export interface AppleReceiptValidationResponse {
  valid: boolean;
  product_id?: string;
  expiration_date?: string;
  error?: string;
}
