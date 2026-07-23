import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
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

export class SendGiftDto {
  @IsString()
  @IsNotEmpty()
  receiver_id!: string;

  @IsString()
  @IsNotEmpty()
  gift_id!: string;

  @IsOptional()
  @IsString()
  room_id?: string;
}
