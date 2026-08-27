import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GoogleNotificationDto {
  @IsString()
  @IsNotEmpty()
  purchaseToken!: string;

  @IsString()
  @IsNotEmpty()
  productId!: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
