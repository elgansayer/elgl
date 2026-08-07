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
      'The receipt token from the purchase. For iOS this is the base64-encoded App Store receipt. For Android this is the Google Play purchase token. For web/Stripe this is the Stripe checkout session ID (e.g. cs_test_xxx).',
    example: 'cs_test_a1b2c3d4e5f6',
  })
  @IsString()
  @IsNotEmpty()
  receipt_token!: string;

  @ApiPropertyOptional({
    description:
      'The platform where the purchase was made. Defaults to `web` when omitted.',
    enum: ['ios', 'android', 'web'],
    example: 'web',
    default: 'web',
  })
  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform?: 'ios' | 'android' | 'web';
}

export class CreateCoinCheckoutSessionDto {
  @ApiProperty({
    description:
      'The ID of the coin package to purchase. Valid values come from the `GET /economy/packages` endpoint.',
    example: 'coins_small',
  })
  @IsString()
  @IsNotEmpty()
  package_id!: string;
}

export class UnlockStickerPackDto {
  @ApiProperty({
    description:
      'The ID of the sticker pack to unlock. Valid pack IDs are returned by `GET /economy/sticker-packs`.',
    example: 'sticker_pack_animated',
  })
  @IsString()
  @IsNotEmpty()
  pack_id!: string;
}

export class SendGiftDto {
  @ApiProperty({
    description: 'UUID of the user who will receive the virtual gift.',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789',
  })
  @IsUUID()
  receiver_id!: string;

  @ApiProperty({
    description:
      'UUID of the virtual gift to send. Gift IDs are listed in `GET /economy/catalog`.',
    format: 'uuid',
    example: 'f9g8h7j6-k5l4-m3n2-p1q0-rst0987654321',
  })
  @IsUUID()
  gift_id!: string;

  @ApiPropertyOptional({
    description:
      'Optional UUID of the chat room to associate this gift with. When provided, the gift notification includes room context for the recipient.',
    format: 'uuid',
    example: 'room_uuid_abc123',
  })
  @IsOptional()
  @IsUUID()
  room_id?: string;
}
