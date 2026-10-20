import {
  IsString,
  IsArray,
  ArrayNotEmpty,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePollDto {
  @ApiProperty({
    description: 'Poll question (1-300 characters)',
    example: 'Which topic should we discuss next?',
    minLength: 1,
    maxLength: 300,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  question!: string;

  @ApiProperty({
    description: 'Array of poll options (each max 100 characters)',
    type: [String],
    example: [
      'Travel experiences',
      'Food and culture',
      'Music and entertainment',
    ],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  options!: string[];
}
