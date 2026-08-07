import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFlashcardDto {
  @ApiProperty({
    description: 'The word token to learn (lowercase, trimmed)',
    example: 'bonjour',
  })
  @IsString()
  @IsNotEmpty()
  word_token!: string;

  @ApiPropertyOptional({
    description: 'Original sentence context where the word appeared',
    example: 'Je dis bonjour a mon voisin chaque matin.',
  })
  @IsOptional()
  @IsString()
  original_context?: string;

  @ApiProperty({
    description: "Translation of the word token into the user's native language",
    example: 'hello',
  })
  @IsString()
  @IsNotEmpty()
  translation!: string;

  @ApiPropertyOptional({
    description: 'Dictionary definition of the word token',
    example: 'Used as a greeting when meeting someone.',
  })
  @IsOptional()
  @IsString()
  definition?: string;

  @ApiPropertyOptional({
    description: 'URL to an audio pronunciation clip (Cloudflare R2)',
    example: 'https://r2.example.com/pronunciation/bonjour.mp3',
  })
  @IsOptional()
  @IsString()
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
