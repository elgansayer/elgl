import { IsUUID, IsString, IsOptional, IsObject } from 'class-validator';

export class SendSystemBroadcastDto {
  @IsUUID()
  target_user_id!: string;

  @IsString()
  @IsOptional()
  text?: string;

  @IsString()
  @IsOptional()
  i18nKey?: string;

  @IsObject()
  @IsOptional()
  params?: Record<string, any>;
}
