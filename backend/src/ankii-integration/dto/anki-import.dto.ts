import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ImportAnkiTsvDto {
  @ApiProperty({
    description:
      'UTF-8 tab-separated Anki text export. Supports Front, Back, optional Context, and optional Definition columns.',
    example: '#separator:tab\nbonjour\thello\tBonjour, Marie.\ta greeting',
    maxLength: 512000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(512000)
  content!: string;
}