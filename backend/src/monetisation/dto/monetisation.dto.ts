import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';

export class CreateDiagnosticLogDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['POSTGIS', 'CENTRIFUGO', 'REDIS', 'LIVEKIT'])
  category!: 'POSTGIS' | 'CENTRIFUGO' | 'REDIS' | 'LIVEKIT';

  @IsString()
  @IsNotEmpty()
  @IsIn(['info', 'success', 'warn'])
  status!: 'info' | 'success' | 'warn';

  @IsString()
  @IsNotEmpty()
  message!: string;
}

export class AppleReceiptValidationDto {
  @IsString()
  @IsNotEmpty()
  receipt_data!: string;

  @IsOptional()
  @IsBoolean()
  exclude_old_transactions?: boolean;
}

export class CreateCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['consumer_8_ukp_10_usd', 'consumer_50_ukp_63_usd'])
  planId!: 'consumer_8_ukp_10_usd' | 'consumer_50_ukp_63_usd';

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
