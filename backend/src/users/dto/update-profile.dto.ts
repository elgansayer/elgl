import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
  Matches,
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
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  native_languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  target_languages?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  interests?: string[];

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
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'primary_accent_color must be a valid hex color code',
  })
  primary_accent_color?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsBoolean()
  privacy_hide_gender?: boolean;

  @IsOptional()
  @IsString()
  profile_visibility?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(A[12]|B[12]|C[12])$/, {
    message: 'proficiency_level must be one of A1, A2, B1, B2, C1, C2',
  })
  proficiency_level?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  learning_goals?: string;
}
