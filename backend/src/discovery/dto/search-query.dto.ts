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
    description: 'Latitude for geo-spatial proximity search (-90 to 90)',
    minimum: -90,
    maximum: 90,
    example: 35.6895,
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
    description: 'Longitude for geo-spatial proximity search (-180 to 180)',
    minimum: -180,
    maximum: 180,
    example: 139.6917,
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
    description: 'Search radius in metres (1 000 to 20 000 000)',
    minimum: 1000,
    maximum: 20000000,
    default: 50000,
    example: 50000,
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
    description: 'Filter by native language (ISO 639-1 code)',
    example: 'ja',
  })
  @IsOptional()
  @IsString()
  native_languages?: string;

  @ApiPropertyOptional({
    description: 'Filter by target language the partner is learning (ISO 639-1 code)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  target_language?: string;

  @ApiPropertyOptional({
    description: 'Only return serious learners (study streak > 7 and correction ratio >= 0.8)',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  serious_learner_only?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by proficiency level',
    example: 'intermediate',
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description: 'Filter by gender (VIP users only)',
    example: 'female',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: 'Filter by interest keyword',
    example: 'music',
  })
  @IsOptional()
  @IsString()
  interests?: string;

  @ApiPropertyOptional({
    description: 'Minimum age filter (1 to 120)',
    minimum: 1,
    maximum: 120,
    example: 18,
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
    description: 'Maximum age filter (1 to 120)',
    minimum: 1,
    maximum: 120,
    example: 99,
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
    description: 'Only return users currently hosting an audio room',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  voice_room_active?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order: best_match, online_now, nearest, or newest',
    example: 'best_match',
    enum: ['best_match', 'online_now', 'nearest', 'newest'],
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: 'Only return users with an audio introduction',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  has_audio_intro?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by country (case-insensitive substring match)',
    example: 'Japan',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by city (case-insensitive substring match)',
    example: 'Tokyo',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Force serious learner mode filtering (auto-set when profile has serious_learner_mode enabled)',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  serious_learner_mode?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by learning goals (comma-separated)',
    example: 'conversation,grammar',
  })
  @IsOptional()
  @IsString()
  learning_goals?: string;

  @ApiPropertyOptional({
    description: 'Learning goals match mode (any or all)',
    example: 'any',
    enum: ['any', 'all'],
  })
  @IsOptional()
  @IsString()
  learning_goals_mode?: string;

  @ApiPropertyOptional({
    description: 'Filter by morning availability',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_morning?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by afternoon availability',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_afternoon?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by evening availability',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_evening?: boolean;

  @ApiPropertyOptional({
    description: 'Exact availability start time for overlap filtering (HH:mm format)',
    example: '09:00',
    pattern: '^\\d{2}:\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'available_time_start must be in HH:mm format',
  })
  available_time_start?: string;

  @ApiPropertyOptional({
    description: 'Exact availability end time for overlap filtering (HH:mm format)',
    example: '17:00',
    pattern: '^\\d{2}:\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'available_time_end must be in HH:mm format',
  })
  available_time_end?: string;
}
