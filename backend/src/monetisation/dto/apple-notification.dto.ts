import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AppleNotificationDto {
  @IsString()
  @IsNotEmpty()
  notificationType!: string;

  @IsString()
  @IsNotEmpty()
  subtype!: string;

  @IsOptional()
  @IsString()
  receiptData?: string;
}
