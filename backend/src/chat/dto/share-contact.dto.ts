import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class ShareContactDto {
  @IsUUID()
  @IsNotEmpty()
  roomId!: string;

  @IsUUID()
  @IsNotEmpty()
  contactUserId!: string;

  @IsOptional()
  @IsString()
  greetingText?: string;
}
