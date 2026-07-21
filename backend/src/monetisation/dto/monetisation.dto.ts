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
