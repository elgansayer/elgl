import { IsBoolean, IsOptional, IsObject, ValidateNested, IsString, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryPreferenceDto {
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  in_app?: boolean;
}

export class NotificationPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  new_message?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  call_invite?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  moment_like?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  moment_comment?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  correction?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  gift?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  profile_view?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  study_reminder?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  friend_request?: CategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  audio_room_invite?: CategoryPreferenceDto;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'quiet_hours_start must be in HH:mm format (24-hour)',
  })
  quiet_hours_start?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'quiet_hours_end must be in HH:mm format (24-hour)',
  })
  quiet_hours_end?: string;

  @IsOptional()
  @IsBoolean()
  do_not_disturb?: boolean;
}
