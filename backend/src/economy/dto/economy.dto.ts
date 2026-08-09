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
    description:
      'Receipt token from the platform (Stripe session ID, Apple receipt data, Google Play purchase token)',
    example: 'cs_test_a1b2c3d4e5f6',
  })
  @IsString()
  @IsNotEmpty()
  receipt_token!: string;

  @ApiPropertyOptional({
    description: 'Platform the purchase was made on. Auto-detected if omitted.',
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
    description:
      'Receipt token from the platform (Stripe session ID, Apple receipt data, Google Play purchase token)',
    example: 'cs_test_a1b2c3d4e5f6',
  })
  @IsString()
  @IsNotEmpty()
  receipt_token!: string;

  @ApiProperty({
    description: 'Platform the receipt is from',
    enum: ['ios', 'android', 'web'],
    example: 'web',
  })
  @IsString()
  @IsNotEmpty()
  platform!: 'ios' | 'android' | 'web';
}

export class VerifiedPurchaseDto {
  @ApiProperty({
    description: 'Platform-specific transaction identifier',
    example: 'cs_test_a1b2c3d4e5f6',
  })
  @IsString()
  @IsNotEmpty()
  transaction_id!: string;

  @ApiProperty({
    description:
      'Product ID from the platform (must match a COIN_PACKAGES platform_product_id entry)',
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
    description: 'ID of the coin package to purchase',
    enum: ['coins_small', 'coins_medium', 'coins_large', 'coins_mega'],
    example: 'coins_small',
  })
  @IsString()
  @IsNotEmpty()
  package_id!: string;
}

export class UnlockStickerPackDto {
  @ApiProperty({
    description: 'ID of the sticker pack to unlock',
    example: 'stk_pack_1',
  })
  @IsString()
  @IsNotEmpty()
  pack_id!: string;
}

export class SendGiftDto {
  @ApiProperty({
    description: 'UUID of the user receiving the gift',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
    format: 'uuid',
  })
  @IsUUID()
  receiver_id!: string;

  @ApiProperty({
    description: 'UUID of the gift from the catalog',
    example: 'gift_rose',
    format: 'uuid',
  })
  @IsUUID()
  gift_id!: string;

  @ApiPropertyOptional({
    description:
      'UUID of the audio room where the gift is being sent (for room-level gift broadcasts)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  room_id?: string;
}
