import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class LegacyPreferenceChannelDto {
  @IsBoolean()
  readonly push!: boolean;

  @IsBoolean()
  readonly badge!: boolean;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LegacyPreferenceChannelDto)
  readonly direct_messages?: LegacyPreferenceChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegacyPreferenceChannelDto)
  readonly groups?: LegacyPreferenceChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegacyPreferenceChannelDto)
  readonly likes?: LegacyPreferenceChannelDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegacyPreferenceChannelDto)
  readonly voice_rooms?: LegacyPreferenceChannelDto;

  @IsOptional()
  @IsBoolean()
  readonly do_not_disturb?: boolean;

  @IsOptional()
  @IsString()
  readonly quiet_hours_start?: string | null;

  @IsOptional()
  @IsString()
  readonly quiet_hours_end?: string | null;
}
