import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Latitude for location-based search (-90 to 90)',
    example: 35.6895,
    minimum: -90,
    maximum: 90,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude for location-based search (-180 to 180)',
    example: 139.6917,
    minimum: -180,
    maximum: 180,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Search radius in metres (1000-20000000, default 50000)',
    example: 50000,
    minimum: 1000,
    maximum: 20000000,
    default: 50000,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  @IsNumber()
  @Min(1000)
  @Max(20000000)
  radius_metres?: number = 50000;

  @ApiPropertyOptional({
    description: 'Comma-separated list of native language ISO 639-1 codes',
    example: 'en,fr',
  })
  @IsOptional()
  @IsString()
  native_languages?: string;

  @ApiPropertyOptional({
    description: 'Target language ISO 639-1 code',
    example: 'ja',
  })
  @IsOptional()
  @IsString()
  target_language?: string;

  @ApiPropertyOptional({
    description: 'Filter to only show serious learners (study streak > 7 and correction ratio >= 0.8)',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  serious_learner_only?: boolean;

  @ApiPropertyOptional({
    description: 'Proficiency level filter',
    example: 'intermediate',
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description: 'Gender filter (VIP users only)',
    example: 'female',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated list of interest tags',
    example: 'sports,music',
  })
  @IsOptional()
  @IsString()
  interests?: string;

  @ApiPropertyOptional({
    description: 'Minimum age filter (1-120)',
    example: 18,
    minimum: 1,
    maximum: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  @IsNumber()
  @Min(1)
  @Max(120)
  age_min?: number;

  @ApiPropertyOptional({
    description: 'Maximum age filter (1-120)',
    example: 65,
    minimum: 1,
    maximum: 120,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  @IsNumber()
  @Min(1)
  @Max(120)
  age_max?: number;

  @ApiPropertyOptional({
    description: 'Filter to only show users currently hosting voice rooms',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  voice_room_active?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order: best_match, nearest, newest, or online_now',
    example: 'best_match',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: 'Filter to only show users with audio introductions',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  has_audio_intro?: boolean;

  @ApiPropertyOptional({
    description: 'Country filter (case-insensitive partial match)',
    example: 'Japan',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'City filter (case-insensitive partial match)',
    example: 'Tokyo',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Serious learner mode flag (auto-set when user has it enabled in profile)',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  serious_learner_mode?: boolean;

  @ApiPropertyOptional({
    description: 'Comma-separated list of learning goals to match',
    example: 'fluency,cultural',
  })
  @IsOptional()
  @IsString()
  learning_goals?: string;

  @ApiPropertyOptional({
    description: 'Learning goals matching mode',
    example: 'any',
  })
  @IsOptional()
  @IsString()
  learning_goals_mode?: string;

  @ApiPropertyOptional({
    description: 'Filter users available in the morning',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_morning?: boolean;

  @ApiPropertyOptional({
    description: 'Filter users available in the afternoon',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_afternoon?: boolean;

  @ApiPropertyOptional({
    description: 'Filter users available in the evening',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_evening?: boolean;

  @ApiPropertyOptional({
    description: 'Availability start time in HH:mm format',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'available_time_start must be in HH:mm format',
  })
  available_time_start?: string;

  @ApiPropertyOptional({
    description: 'Availability end time in HH:mm format',
    example: '17:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'available_time_end must be in HH:mm format',
  })
  available_time_end?: string;
}
