import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseCoinsDto {
  @ApiProperty({
    description: 'Receipt token from Apple, Google Play, or Stripe checkout session ID',
    example: 'cs_test_a1b2c3d4e5f6',
  })
  @IsString()
  @IsNotEmpty()
  receipt_token!: string;

  @ApiPropertyOptional({
    description: 'Payment platform. Auto-detected from receipt if omitted',
    enum: ['ios', 'android', 'web'],
    example: 'web',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';
}

export class VerifyReceiptDto {
  @ApiProperty({
    description: 'Receipt token to verify with the store',
    example: 'cs_test_a1b2c3d4e5f6',
  })
  @IsString()
  @IsNotEmpty()
  receipt_token!: string;

  @ApiProperty({
    description: 'Platform the receipt originated from',
    enum: ['ios', 'android', 'web'],
    example: 'ios',
  })
  @IsString()
  @IsNotEmpty()
  platform!: 'ios' | 'android' | 'web';
}

export class VerifiedPurchaseDto {
  @ApiProperty({
    description: 'Unique transaction identifier from the store',
    example: 'txn_2f3g4h5i6j7k',
  })
  @IsString()
  @IsNotEmpty()
  transaction_id!: string;

  @ApiProperty({
    description: 'Product identifier matching a coin package',
    example: 'coins_small_web',
  })
  @IsString()
  @IsNotEmpty()
  product_id!: string;

  @ApiProperty({
    description: 'Platform the purchase was made on',
    enum: ['ios', 'android', 'web'],
    example: 'web',
  })
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform!: 'ios' | 'android' | 'web';
}

export class CreateCoinCheckoutSessionDto {
  @ApiProperty({
    description: 'Coin package ID (coins_small, coins_medium, coins_large, coins_mega)',
    example: 'coins_small',
  })
  @IsString()
  @IsNotEmpty()
  package_id!: string;
}

export class UnlockStickerPackDto {
  @ApiProperty({
    description: 'Sticker pack ID to unlock with coins',
    example: 'sticker_pack_summer_2026',
  })
  @IsString()
  @IsNotEmpty()
  pack_id!: string;
}

export class SendGiftDto {
  @ApiProperty({
    description: 'UUID of the gift recipient',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  receiver_id!: string;

  @ApiProperty({
    description: 'UUID of the virtual gift from the catalog',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  gift_id!: string;

  @ApiPropertyOptional({
    description: 'UUID of the chat room. Required only for in-room gift sending',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  room_id?: string;
}
