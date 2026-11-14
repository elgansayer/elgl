import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

const SOCIAL_HANDLE_PATTERN = /^@?[A-Za-z0-9_.-]{2,60}$/;

export class ShareContactDto {
  @IsUUID()
  target_user_id!: string;

  @IsOptional()
  @IsBoolean()
  share_email?: boolean;

  @IsOptional()
  @IsBoolean()
  share_phone?: boolean;

  @IsOptional()
  @IsString()
  @Matches(SOCIAL_HANDLE_PATTERN, {
    message: 'custom_social_handle must be a valid handle',
  })
  custom_social_handle?: string;
}
