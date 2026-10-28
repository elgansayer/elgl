import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CategoryPreferenceDto {
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

export class LegacyCategoryPreferenceDto {
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @IsOptional()
  @IsBoolean()
  badge?: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LegacyCategoryPreferenceDto)
  direct_messages?: LegacyCategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegacyCategoryPreferenceDto)
  groups?: LegacyCategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegacyCategoryPreferenceDto)
  likes?: LegacyCategoryPreferenceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegacyCategoryPreferenceDto)
  voice_rooms?: LegacyCategoryPreferenceDto;

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

  @IsOptional()
  @IsBoolean()
  do_not_disturb?: boolean;

  @IsOptional()
  @IsString()
  quiet_hours_start?: string;

  @IsOptional()
  @IsString()
  quiet_hours_end?: string;

  @IsOptional()
  @IsString()
  customToneUrl?: string;

  @IsOptional()
  @IsString()
  vibrationPattern?: string;
}
