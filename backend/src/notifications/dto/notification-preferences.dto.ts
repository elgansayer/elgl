import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CategoryPreferenceDto {
  @IsBoolean()
  @IsOptional()
  push?: boolean;

  @IsBoolean()
  @IsOptional()
  email?: boolean;

  @IsBoolean()
  @IsOptional()
  in_app?: boolean;

  @IsBoolean()
  @IsOptional()
  badges?: boolean;
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
  @ValidateNested()
  @Type(() => CategoryPreferenceDto)
  new_follower?: CategoryPreferenceDto;

  @IsString()
  @IsOptional()
  quiet_hours_start?: string | null;

  @IsString()
  @IsOptional()
  quiet_hours_end?: string | null;

  @IsBoolean()
  @IsOptional()
  do_not_disturb?: boolean;

  @IsOptional()
  @IsString()
  customToneUrl?: string;

  @IsOptional()
  @IsString()
  vibrationPattern?: string;
}
