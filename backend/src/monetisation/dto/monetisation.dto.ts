import { IsIn, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class StripeWebhookDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsOptional()
  data?: {
    object?: {
      metadata?: {
        userId?: string;
        tier?: 'consumer' | 'developer';
      };
      customer_email?: string;
    };
  };
}

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

export class AppleNotificationDto {
  @IsString()
  @IsNotEmpty()
  signedPayload!: string;
}

export class AppleReceiptValidationDto {
  @IsString()
  @IsNotEmpty()
  receipt_data!: string;

  @IsOptional()
  @IsBoolean()
  exclude_old_transactions?: boolean;
}
