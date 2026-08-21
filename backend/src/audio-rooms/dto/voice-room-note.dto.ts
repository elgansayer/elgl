import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVoiceRoomNoteDto {
  @ApiProperty({
    description: 'Note content',
    example: 'Practise the subjunctive tense with native speakers here.',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Vocabulary keyword or phrase relevant to the note',
    example: 'subjunctive',
  })
  @IsString()
  @IsOptional()
  vocabulary?: string;
}
