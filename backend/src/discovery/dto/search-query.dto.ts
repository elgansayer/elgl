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
    description: 'GPS latitude for geospatial proximity search (-90 to 90)',
    minimum: -90,
    maximum: 90,
    example: 35.6762,
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
    description: 'GPS longitude for geospatial proximity search (-180 to 180)',
    minimum: -180,
    maximum: 180,
    example: 139.6503,
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
    description: 'Proximity search radius in metres (default 50000)',
    minimum: 1000,
    maximum: 20000000,
    default: 50000,
    example: 10000,
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
    description: 'Required native language of partner (ISO 639-1 code)',
    example: 'ja',
  })
  @IsOptional()
  @IsString()
  native_languages?: string;

  @ApiPropertyOptional({
    description: 'Required target language of partner (ISO 639-1 code)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  target_language?: string;

  @ApiPropertyOptional({
    description: 'Filter to serious learners only (study streak > 7 days AND correction ratio >= 0.8)',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  serious_learner_only?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by proficiency level (e.g. Beginner, Intermediate, Advanced)',
    example: 'Intermediate',
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description: 'Filter by gender (VIP users only)',
    example: 'Female',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description: 'Filter by shared interests',
    example: 'music',
  })
  @IsOptional()
  @IsString()
  interests?: string;

  @ApiPropertyOptional({
    description: 'Minimum age filter (1-120)',
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
    description: 'Maximum age filter (1-120)',
    minimum: 1,
    maximum: 120,
    example: 35,
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
    description: 'Filter to users currently active in an audio room',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  voice_room_active?: boolean;

  @ApiPropertyOptional({
    description: 'Sort order for results',
    example: 'distance',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description: 'Filter to users who have recorded an audio introduction',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  has_audio_intro?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by country name (fuzzy ILIKE match)',
    example: 'Japan',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by city name (fuzzy ILIKE match)',
    example: 'Tokyo',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Enable serious learner mode (auto-enabled for serious learners)',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  serious_learner_mode?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by learning goals',
    example: 'fluency',
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
    description: 'Filter by morning availability',
    example: true,
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
    description: 'Available time start in HH:mm format',
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
    description: 'Available time end in HH:mm format',
    example: '18:00',
    pattern: '^\\d{2}:\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'available_time_end must be in HH:mm format',
  })
  available_time_end?: string;
}
