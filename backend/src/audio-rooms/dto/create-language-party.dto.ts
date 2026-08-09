import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLanguagePartyDto {
  @ApiProperty({
    description: 'Title of the language party',
    example: 'French Beginners Corner',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    description: 'Language pair identifier (e.g., "en-fr")',
    example: 'en-fr',
  })
  @IsString()
  language_pair!: string;

  @ApiPropertyOptional({
    description: 'Topic tag categorising the party',
    example: 'beginners',
  })
  @IsOptional()
  @IsString()
  topic_tag?: string;

  @ApiPropertyOptional({
    description: 'Whether the party includes video streaming',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_video_stream?: boolean;

  @ApiPropertyOptional({
    description: 'Language proficiency level',
    example: 'beginner',
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of simultaneous speakers on stage',
    example: 5,
    minimum: 2,
    default: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(2)
  max_speakers?: number;

  @ApiPropertyOptional({
    description: 'Scheduled duration in minutes',
    example: 60,
    minimum: 1,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration_minutes?: number;
}
