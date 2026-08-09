import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class LanguagePairQueryDto {
  @ApiPropertyOptional({
    description:
      'Filter by native language of potential partners (ISO 639-1 code). At least one of native_language or target_language is recommended.',
    example: 'ja-JP',
  })
  @IsOptional()
  @IsString()
  native_language?: string;

  @ApiPropertyOptional({
    description:
      'Filter by the target language partners are learning (ISO 639-1 code). When both native_language and target_language are provided, the query returns reciprocal language exchange partners.',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  target_language?: string;

  @ApiPropertyOptional({
    description: 'Zero-based page number for cursor pagination.',
    minimum: 0,
    default: 0,
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  page?: number = 0;

  @ApiPropertyOptional({
    description: 'Maximum number of results per page (1-100).',
    minimum: 1,
    default: 50,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    description:
      'Sort order. "best_match" sorts by partner_of_week, study_streak_days, and correction_ratio. "newest" sorts by created_at descending.',
    enum: ['best_match', 'newest'],
    default: 'best_match',
    example: 'best_match',
  })
  @IsOptional()
  @IsString()
  sort?: string = 'best_match';

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
    description: 'Filter by country (case-insensitive ILIKE match).',
    example: 'Japan',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by city (case-insensitive ILIKE match).',
    example: 'Tokyo',
  })
  @IsOptional()
  @IsString()
  city?: string;

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
    description: 'Only return partners currently hosting a LiveKit audio room.',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  voice_room_active?: boolean;
}
