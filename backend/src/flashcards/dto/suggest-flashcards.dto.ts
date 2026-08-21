import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SuggestFlashcardsDto {
  @ApiProperty({
    description: 'Message text to extract vocabulary suggestions from',
    example: 'Je voudrais apprendre le francais avec des amis.',
  })
  @IsString()
  @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({
    description: 'User ID for excluding already-known words (SRS level 4)',
    example: 'c9b1a2d3-e4f5-6789-abcd-ef0123456789',
  })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Target language ISO 639-1 code for word segmentation',
    example: 'fr',
  })
  @IsOptional()
  @IsString()
  target_language?: string;

  @ApiPropertyOptional({
    description: 'When true, exclude words already at SRS level 4 (Known)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  exclude_known?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of suggestions to return (hard cap at 100)',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  max_results?: number = 20;
}
