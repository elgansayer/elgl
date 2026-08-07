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
    description: 'Native language ISO code (e.g. en, ja, es)',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  native_language?: string;

  @ApiPropertyOptional({
    description: 'Target language ISO code (e.g. ja, en, fr)',
    example: 'ja',
  })
  @IsOptional()
  @IsString()
  target_language?: string;

  @ApiPropertyOptional({
    description: 'Zero-based page number for pagination',
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
    description: 'Number of results per page',
    minimum: 1,
    default: 50,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Sort order (e.g. best_match, newest). Default: best_match',
    example: 'best_match',
    default: 'best_match',
  })
  @IsOptional()
  @IsString()
  sort?: string = 'best_match';

  @ApiPropertyOptional({
    description: 'Filter by proficiency level',
    example: 'Intermediate',
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description: 'Filter to users with audio introductions',
    example: true,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  has_audio_intro?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by country name',
    example: 'Japan',
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({
    description: 'Filter by city name',
    example: 'Tokyo',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by learning goals',
    example: 'fluency',
  })
  @IsOptional()
  @IsString()
  learning_goals?: string;

  @ApiPropertyOptional({
    description: 'Learning goals matching mode (e.g. any, all)',
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
    description: 'Filter to users currently active in an audio room',
    example: false,
  })
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  voice_room_active?: boolean;
}
