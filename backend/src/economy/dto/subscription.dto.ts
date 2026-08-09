import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
} from 'class-validator';

/**
 * DTO for verifying a subscription receipt.
 */
export class VerifySubscriptionDto {
  @IsString()
  receipt_token: string;

  @IsOptional()
  @IsString()
  platform?: 'ios' | 'android' | 'web';
}

/**
 * DTO for updating a user's subscription status.
 */
export class UpdateSubscriptionDto {
  @IsString()
  user_id: string;

  @IsString()
  product_id: string;

  @IsString()
  status:
    'active' | 'canceled' | 'expired' | 'on_hold' | 'grace_period' | 'revoked';

  @IsOptional()
  @IsString()
  transaction_id?: string;

  @IsOptional()
  @IsString()
  purchase_token?: string;

  @IsOptional()
  @IsBoolean()
  auto_renew?: boolean;

  @IsOptional()
  @IsString()
  expires_at?: string;
}

/**
 * DTO for creating a subscription product.
 */
export class CreateSubscriptionProductDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  price: number;

  @IsString()
  currency: string;

  @IsNumber()
  duration_days: number;

  @IsOptional()
  @IsString()
  ios_product_id?: string;

  @IsOptional()
  @IsString()
  android_product_id?: string;

  @IsOptional()
  @IsString()
  web_product_id?: string;
}

/**
 * DTO for handling a subscription notification from Apple or Google.
 */
export class HandleSubscriptionNotificationDto {
  @IsString()
  @IsEnum(['apple', 'google'])
  provider: 'apple' | 'google';

  @IsString()
  signedPayload?: string;

  @IsOptional()
  message?: unknown;
}
