import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description:
      'Latitude for location-based search (-90 to 90). Required with longitude for proximity queries using PostGIS ST_DWithin.',
    minimum: -90,
    maximum: 90,
    example: 51.5074,
  })
  @ValidateIf(
    (object: SearchQueryDto) =>
      object.latitude !== undefined || object.longitude !== undefined,
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description:
      'Longitude for location-based search (-180 to 180). Required with latitude for proximity queries.',
    minimum: -180,
    maximum: 180,
    example: -0.1278,
  })
  @ValidateIf(
    (object: SearchQueryDto) =>
      object.latitude !== undefined || object.longitude !== undefined,
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description:
      'Search radius in metres (1000 - 250000). Defaults to 50000 (50 km). Used by the PostGIS ST_DWithin RPC for proximity filtering.',
    minimum: 1000,
    maximum: 250000,
    default: 50000,
    example: 10000,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  @IsNumber()
  @Min(1000)
  @Max(250000)
  radius_metres?: number = 50000;

  @ApiPropertyOptional({
    description:
      'Filter by native language of potential partners (ISO 639-1 code, e.g. "ja-JP"). Partners whose native_languages array contains this value are returned.',
    example: 'ja-JP',
  })
  @IsOptional()
  @IsString()
  native_languages?: string;

  @ApiPropertyOptional({
    description:
      'Filter by target language partners are learning (ISO 639-1 code). Partners whose target_languages array contains this value are returned.',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  target_language?: string;

  @ApiPropertyOptional({
    description:
      'Restrict to "serious learners": users with study_streak_days > 7 AND correction_ratio >= 0.8. Auto-enabled for users with serious_learner_mode profile setting.',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  serious_learner_only?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by proficiency level (A1-C2). Matches the proficiency_level column on user profiles.',
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
    example: 'B1',
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description:
      'Filter by gender of potential partners. Only available for VIP users.',
    enum: ['male', 'female', 'other'],
    example: 'female',
  })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({
    description:
      'Comma-separated interest tags. Partners matching any tag are returned via PostgreSQL array overlap query.',
    example: 'sports,music,travel',
  })
  @IsOptional()
  @IsString()
  interests?: string;

  @ApiPropertyOptional({
    description: 'Minimum age filter (1-120).',
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
    description: 'Maximum age filter (1-120).',
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
    description: 'Only return partners currently hosting a LiveKit audio room.',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  voice_room_active?: boolean;

  @ApiPropertyOptional({
    description:
      'Sort order. "best_match" promotes Partner of the Week first, then by study_streak_days and correction_ratio. "online_now" sorts by last_active_at. "nearest" sorts by distance. "newest" sorts by created_at.',
    enum: ['best_match', 'online_now', 'nearest', 'newest'],
    default: 'best_match',
    example: 'best_match',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({
    description:
      'Only return partners who have uploaded an audio introduction.',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  has_audio_intro?: boolean;

  @ApiPropertyOptional({
    description:
      'Filter by country (case-insensitive ILIKE match). VIP users may spoof their country via mock_country in their profile.',
    example: 'Japan',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description:
      'Filter by city (case-insensitive ILIKE match). VIP users may spoof their city via mock_city in their profile.',
    example: 'Tokyo',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description:
      'When true, forces serious_learner_only filter regardless of user profile settings.',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  serious_learner_mode?: boolean;

  @ApiPropertyOptional({
    description:
      'Comma-separated learning goals for filtering (e.g. "fluency,grammar"). Matched case-insensitively against user learning_goals arrays.',
    example: 'fluency,pronunciation',
  })
  @IsOptional()
  @IsString()
  learning_goals?: string;

  @ApiPropertyOptional({
    description: 'Mode for learning_goals filtering. Reserved for future use.',
    example: 'any',
  })
  @IsOptional()
  @IsString()
  learning_goals_mode?: string;

  @ApiPropertyOptional({
    description: 'Filter partners available in the morning.',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_morning?: boolean;

  @ApiPropertyOptional({
    description: 'Filter partners available in the afternoon.',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_afternoon?: boolean;

  @ApiPropertyOptional({
    description: 'Filter partners available in the evening.',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  availability_evening?: boolean;

  @ApiPropertyOptional({
    description:
      'HH:mm formatted start time for availability overlap filtering. Used with available_time_end for Tandem-style exact time matching.',
    example: '18:00',
    pattern: '^\\d{2}:\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'available_time_start must be in HH:mm format',
  })
  available_time_start?: string;

  @ApiPropertyOptional({
    description:
      'HH:mm formatted end time for availability overlap filtering. Used with available_time_start for Tandem-style exact time matching.',
    example: '22:00',
    pattern: '^\\d{2}:\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'available_time_end must be in HH:mm format',
  })
  available_time_end?: string;
}
