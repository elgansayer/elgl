import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateFlashcardDto {
  @ApiProperty({
    description: 'The word token to learn (lowercase, trimmed)',
    example: 'bonjour',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  word_token!: string;

  @ApiPropertyOptional({
    description: 'Original sentence context where the word appeared',
    example: 'Je dis bonjour a mon voisin chaque matin.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  original_context?: string;

  @ApiProperty({
    description:
      "Translation of the word token into the user's native language",
    example: 'hello',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  translation!: string;

  @ApiPropertyOptional({
    description: 'Dictionary definition of the word token',
    example: 'Used as a greeting when meeting someone.',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(1000)
  definition?: string;

  @ApiPropertyOptional({
    description: 'HTTP(S) URL to an audio pronunciation clip',
    example: 'https://r2.example.com/pronunciation/bonjour.mp3',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
  })
  @MaxLength(2000)
  pronunciation_url?: string;
}

export class UpdateSrsDto {
  @ApiProperty({
    description:
      'SM-2 recall quality score (0-5). 0: complete blackout, 1: incorrect but remembered upon seeing, 2: incorrect but seemed easy, 3: correct with serious difficulty, 4: correct after hesitation, 5: perfect response.',
    minimum: 0,
    maximum: 5,
    example: 4,
  })
  @IsInt()
  @Min(0)
  @Max(5)
  quality!: number;
}

export class QueryFlashcardsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of flashcards to return (hard cap at 200)',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Number of flashcards to skip for pagination',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description:
      'Optional SRS level filter. 0: New (Blue), 1-3: Learning (Yellow), 4: Known (White).',
    example: '2',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  level?: number;
}

export class QueryDueReviewsDto {
  @ApiPropertyOptional({
    description: 'Maximum number of due reviews to return (hard cap at 100)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of due reviews to skip for pagination',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
