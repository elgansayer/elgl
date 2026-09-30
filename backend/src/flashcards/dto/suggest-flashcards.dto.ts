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
    description:
      'Deprecated compatibility parameter. Ignored by the server; filtering is scoped to the authenticated user.',
    deprecated: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  user_id?: string;

  @ApiPropertyOptional({
    description: 'BCP 47 language tag for word segmentation',
    example: 'fr',
  })
  @IsOptional()
  @IsString()
  @MaxLength(35)
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
