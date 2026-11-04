import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVoiceRoomNoteDto {
  @ApiProperty({
    description: 'Note content or discussion topic',
    example: 'Practise the subjunctive tense with native speakers here.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({
    description: 'Vocabulary keyword or phrase relevant to the note',
    example: 'subjunctive',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  vocabulary?: string;
}
