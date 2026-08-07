import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LanguagePairQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by native language of the partner (ISO 639-1 code)',
    example: 'ja',
  })
  @IsOptional()
  @IsString()
  native_language?: string;

  @ApiPropertyOptional({
    description: 'Filter by target language the partner is learning (ISO 639-1 code)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  target_language?: string;

  @ApiPropertyOptional({
    description: 'Zero-indexed page offset for pagination',
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
    description: 'Maximum number of results to return per page',
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
    description: 'Sort order: best_match, online_now, nearest, or newest',
    default: 'best_match',
    example: 'best_match',
    enum: ['best_match', 'online_now', 'nearest', 'newest'],
  })
  @IsOptional()
  @IsString()
  sort?: string = 'best_match';

  @ApiPropertyOptional({
    description: 'Filter by proficiency level',
    example: 'intermediate',
  })
  @IsOptional()
  @IsString()
  level?: string;

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
    description: 'Only return users currently hosting an audio room',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  voice_room_active?: boolean;
}
