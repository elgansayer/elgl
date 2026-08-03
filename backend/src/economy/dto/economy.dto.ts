import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class PurchaseCoinsDto {
  @IsString()
  @IsNotEmpty()
  receipt_token!: string;

  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';
}

export class VerifiedPurchaseDto {
  @IsString()
  @IsNotEmpty()
  transaction_id!: string;

  @IsString()
  @IsNotEmpty()
  product_id!: string;

  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}

export class CreateCoinCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  package_id!: string;
}

export class UnlockStickerPackDto {
  @IsString()
  @IsNotEmpty()
  pack_id!: string;
}

export class SendGiftDto {
  @IsUUID()
  receiver_id!: string;

  @IsUUID()
  gift_id!: string;

  @IsOptional()
  @IsUUID()
  room_id?: string;
}
