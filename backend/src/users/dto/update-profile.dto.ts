import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CoordinatesDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  native_language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  target_languages?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio_text?: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;

  @IsOptional()
  @IsString()
  audio_intro_url?: string;

  @IsOptional()
  @IsString()
  cover_photo_url?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  location?: CoordinatesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CoordinatesDto)
  mock_location?: CoordinatesDto;

  @IsOptional()
  @IsBoolean()
  privacy_hide_age?: boolean;

  @IsOptional()
  @IsBoolean()
  privacy_hide_location?: boolean;

  @IsOptional()
  @IsBoolean()
  privacy_hide_from_search?: boolean;
}
