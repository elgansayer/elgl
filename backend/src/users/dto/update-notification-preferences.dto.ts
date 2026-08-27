import {
  IsArray,
  ArrayNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  custom_tone_url?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  vibration_pattern?: number[];
}
