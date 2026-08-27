import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
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
    description: 'Two to six unique poll options (each 1-100 characters)',
    type: [String],
    minItems: 2,
    maxItems: 6,
    uniqueItems: true,
    example: [
      'Travel experiences',
      'Food and culture',
      'Music and entertainment',
    ],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @ArrayUnique((option: string) => option.trim().toLocaleLowerCase())
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(100, { each: true })
  options!: string[];
}
