import { IsString, IsOptional, IsInt, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateArticleDto {
  @ApiProperty({
    description: 'Title of the curated reading article',
    example: 'La vie quotidienne en France',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    description: 'CEFR proficiency level of the article content',
    example: 'B1',
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  })
  @IsString()
  cefrLevel!: string;

  @ApiProperty({
    description: 'ISO 639-1 language code of the article text',
    example: 'fr',
  })
  @IsString()
  language!: string;

  @ApiPropertyOptional({
    description: 'Original source URL where the article was curated from',
    example: 'https://example.com/articles/daily-life-france',
  })
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @ApiProperty({
    description: 'Full article text content for tokenised reading display',
    example:
      'Chaque matin, Marie se leve tot pour preparer le petit dejeuner...',
  })
  @IsString()
  contentText!: string;

  @ApiPropertyOptional({
    description: 'Total word count of the article (auto-calculated if omitted)',
    example: 450,
  })
  @IsOptional()
  @IsInt()
  wordCount?: number;

  @ApiPropertyOptional({
    description: 'Difficulty rating from 1 (easiest) to 10 (hardest)',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  difficultyRating?: number;

  @ApiPropertyOptional({
    description: 'Cloudflare R2 URL for the audio narration of the article',
    example: 'https://r2.example.com/audio/articles/fr/daily-life.mp3',
  })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({
    description: 'Cloudflare R2 URL for a cover/illustration image',
    example: 'https://r2.example.com/images/articles/fr/daily-life.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Topic tags for categorisation and discovery filtering',
    example: ['culture', 'daily-life', 'food'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
