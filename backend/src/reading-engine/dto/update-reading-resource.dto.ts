import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/** Maximum content length to prevent unbounded payloads (500 KB of text). */
const MAX_CONTENT_LENGTH = 500_000;

export class UpdateReadingResourceDto {
  @ApiPropertyOptional({ description: 'Title of the reading resource' })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ description: 'Full text content', maxLength: MAX_CONTENT_LENGTH })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(MAX_CONTENT_LENGTH)
  content?: string;

  @ApiPropertyOptional({ description: 'ISO 639-1 language code' })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(5)
  language?: string;

  @ApiPropertyOptional({ description: 'Difficulty level', enum: ['beginner', 'intermediate', 'advanced'] })
  @IsString()
  @IsOptional()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Topic / category tag' })
  @IsString()
  @IsOptional()
  topic?: string;

  @ApiPropertyOptional({ description: 'Original source URL' })
  @IsString()
  @IsOptional()
  sourceUrl?: string;
}