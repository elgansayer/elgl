import 'reflect-metadata';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
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

export class MessageFiltersDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  age_min?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  age_max?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_genders?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_native_languages?: string[];
}

export class BusinessCatalogItemDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  price?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  image_url?: string;
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
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  hobbies?: string[];

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
  enable_location_spoofing?: boolean;

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
  @IsBoolean()
  matchmaking_consent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsBoolean()
  privacy_hide_gender?: boolean;

  @IsOptional()
  @IsBoolean()
  privacy_hide_exact_location?: boolean;

  @IsOptional()
  @IsBoolean()
  privacy_hide_online_status?: boolean;

  @IsOptional()
  @IsBoolean()
  privacy_hide_vip_status?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  mock_country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  mock_city?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;

  @IsOptional()
  @IsBoolean()
  silence_unknown_callers?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(everyone|vips_only|hidden)$/, {
    message: 'profile_visibility must be one of: everyone, vips_only, hidden',
  })
  profile_visibility?: 'everyone' | 'vips_only' | 'hidden';

  @IsOptional()
  @IsString()
  status_visibility?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(200)
  status_text?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  greeting_message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  away_message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  business_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  business_hours?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website_url?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusinessCatalogItemDto)
  catalog?: BusinessCatalogItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => MessageFiltersDto)
  message_filters?: MessageFiltersDto;

  @IsOptional()
  @IsBoolean()
  auto_play_voice_notes?: boolean;

  @IsOptional()
  @IsBoolean()
  sound_effects_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  vibration_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  chat_enter_to_send?: boolean;

  @IsOptional()
  @IsString()
  chat_text_size?: 'small' | 'medium' | 'large';

  @IsOptional()
  @IsBoolean()
  serious_learner_mode?: boolean;

  @IsOptional()
  @IsBoolean()
  @IsOptional()
  @IsBoolean()
  auto_download_media?: boolean;

  @IsOptional()
  study_streak_days?: number;

  @IsOptional()
  correction_ratio?: number;

  @IsOptional()
  @IsBoolean()
  auto_download_wifi_only?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(wifi|cellular)$/, {
    message: 'auto_download_preference must be one of: wifi, cellular',
  })
  auto_download_preference?: 'wifi' | 'cellular';
}
