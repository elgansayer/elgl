import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendSystemMessageDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  i18nKey?: string;

  @IsOptional()
  i18nArgs?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  targetUserId?: string;

  @IsOptional()
  @IsString()
  channel?: string;
}
