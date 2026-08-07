import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Maximum content length to prevent unbounded payloads (500 KB of text). */
const MAX_CONTENT_LENGTH = 500_000;

export class CreateReadingResourceDto {
  @ApiProperty({ description: 'Title of the reading resource', example: 'La Vie Parisienne' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiProperty({ description: 'Full text content of the reading resource', maxLength: MAX_CONTENT_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(MAX_CONTENT_LENGTH)
  content!: string;

  @ApiProperty({ description: 'ISO 639-1 language code', example: 'fr' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(5)
  language!: string;

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