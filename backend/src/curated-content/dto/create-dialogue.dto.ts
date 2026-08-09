import { IsString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DialogueLine {
  @ApiProperty({
    description: 'Speaker name or role for this line',
    example: 'Marie',
  })
  @IsString()
  speaker!: string;

  @ApiProperty({
    description: 'Text spoken by this speaker in the target language',
    example: 'Bonjour, comment ca va ?',
  })
  @IsString()
  text!: string;

  @ApiPropertyOptional({
    description: "English translation of this speaker's line",
    example: 'Hello, how are you?',
  })
  @IsOptional()
  @IsString()
  translation?: string;

  @ApiPropertyOptional({
    description: 'Cloudflare R2 URL for the audio clip of this specific line',
    example: 'https://r2.example.com/audio/dialogues/line-1.mp3',
  })
  @IsOptional()
  @IsString()
  audioUrl?: string;
}

export class CreateDialogueDto {
  @ApiProperty({
    description: 'Title of the curated dialogue',
    example: 'Au cafe',
  })
  @IsString()
  title!: string;

  @ApiProperty({
    description: 'CEFR proficiency level of the dialogue content',
    example: 'A2',
    enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  })
  @IsString()
  cefrLevel!: string;

  @ApiProperty({
    description: 'ISO 639-1 language code of the dialogue text',
    example: 'fr',
  })
  @IsString()
  language!: string;

  @ApiPropertyOptional({
    description: 'Original source URL where the dialogue was curated from',
    example: 'https://example.com/dialogues/at-the-cafe',
  })
  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @ApiProperty({
    description: 'Array of dialogue speaker lines in sequential order',
    type: [DialogueLine],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DialogueLine)
  lines!: DialogueLine[];

  @ApiPropertyOptional({
    description: 'Cloudflare R2 URL for the full dialogue audio recording',
    example: 'https://r2.example.com/audio/dialogues/fr/at-the-cafe.mp3',
  })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({
    description: 'Cloudflare R2 URL for a cover/illustration image',
    example: 'https://r2.example.com/images/dialogues/fr/cafe.jpg',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({
    description: 'Topic tags for categorisation and discovery filtering',
    example: ['restaurant', 'greetings', 'daily-life'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
