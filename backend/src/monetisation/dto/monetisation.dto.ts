import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpgradeVipDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['consumer', 'developer'])
  tier!: 'consumer' | 'developer';
}

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
