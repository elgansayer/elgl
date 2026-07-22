import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class PurchaseCoinsDto {
  @IsString()
  @IsNotEmpty()
  package_id!: string;

  @IsString()
  @IsNotEmpty()
  receipt_token!: string;
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
